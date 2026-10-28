"""Catalogue public : catégories, mots-clés, liste et détail des cours, inscription, avis."""
from django.db.models import Count, F, OuterRef, Q, Subquery
from django.shortcuts import get_object_or_404
from rest_framework import generics, status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.permissions import IsLearner
from apps.ml.models import Recommendation
from apps.tracking.services import record_event

from .models import Category, Course, Enrollment, Review, Tag
from .serializers import (
    CategorySerializer,
    CourseDetailSerializer,
    CourseListSerializer,
    EnrollmentSerializer,
    ReviewSerializer,
    ReviewWriteSerializer,
    TagSerializer,
)
from .services import next_step, with_stats

SORTS = {
    "popular": ["-enrolled_count", "-avg_rating"],
    "rating": [F("avg_rating").desc(nulls_last=True), "-enrolled_count"],
    "newest": [F("published_at").desc(nulls_last=True)],
    "title": ["title"],
}


def _is_learner(request) -> bool:
    return request.user.is_authenticated and request.user.role == "learner"


class CategoryListView(generics.ListAPIView):
    permission_classes = [AllowAny]
    serializer_class = CategorySerializer
    pagination_class = None

    def get_queryset(self):
        return Category.objects.annotate(
            course_count=Count("courses", filter=Q(courses__status=Course.Status.PUBLISHED))
        ).order_by("name")


class TagListView(generics.ListAPIView):
    """Mots-clés. Avec ?popular=1 : les plus utilisés dans les cours publiés (questionnaire d'accueil)."""

    permission_classes = [AllowAny]
    serializer_class = TagSerializer
    pagination_class = None

    def get_queryset(self):
        if self.request.query_params.get("popular") in {"1", "true"}:
            return (
                Tag.objects.annotate(n=Count("courses", filter=Q(courses__status=Course.Status.PUBLISHED)))
                .filter(n__gt=0)
                .order_by("-n", "name")[:20]
            )
        return Tag.objects.order_by("name")


class CourseListView(generics.ListAPIView):
    """Catalogue avec recherche, filtres et tri (dont « recommandés pour moi »)."""

    permission_classes = [AllowAny]
    serializer_class = CourseListSerializer
    filter_backends = []

    def get_queryset(self):
        params = self.request.query_params
        qs = with_stats(Course.objects.published()).select_related("category", "instructor").prefetch_related("tags")

        query = params.get("q", "").strip()
        if query:
            qs = qs.filter(
                Q(title__icontains=query)
                | Q(subtitle__icontains=query)
                | Q(description__icontains=query)
                | Q(tags__name__icontains=query)
                | Q(instructor__first_name__icontains=query)
                | Q(instructor__last_name__icontains=query)
            ).distinct()

        categories = [c for c in params.get("category", "").split(",") if c]
        if categories:
            qs = qs.filter(category__slug__in=categories)
        levels = [lvl for lvl in params.get("level", "").split(",") if lvl]
        if levels:
            qs = qs.filter(level__in=levels)
        duration = [d for d in params.get("duration", "").split(",") if d]
        if duration:
            duration_q = Q()
            if "short" in duration:
                duration_q |= Q(total_minutes__lt=300)
            if "medium" in duration:
                duration_q |= Q(total_minutes__gte=300, total_minutes__lte=600)
            if "long" in duration:
                duration_q |= Q(total_minutes__gt=600)
            qs = qs.filter(duration_q)

        sort = params.get("sort", "recommended" if _is_learner(self.request) else "popular")
        if _is_learner(self.request):
            reco = Recommendation.objects.filter(user=self.request.user, course=OuterRef("pk")).values("score")[:1]
            qs = qs.annotate(reco_score=Subquery(reco))
            if params.get("for_me") in {"1", "true"}:
                qs = qs.filter(reco_score__isnull=False)
            if sort == "recommended":
                return qs.order_by(F("reco_score").desc(nulls_last=True), "-enrolled_count")
        return qs.order_by(*SORTS.get(sort, SORTS["popular"]))

    def get_serializer_context(self):
        context = super().get_serializer_context()
        if _is_learner(self.request):
            from apps.ml.services import match_scores_for_user

            context["match_scores"] = match_scores_for_user(self.request.user)
            context["enrolled_ids"] = set(
                Enrollment.objects.filter(user=self.request.user).values_list("course_id", flat=True)
            )
        return context

    def list(self, request, *args, **kwargs):
        query = request.query_params.get("q", "").strip()
        if query and _is_learner(request) and request.query_params.get("page", "1") == "1":
            record_event(request.user, "search", metadata={"q": query[:100]})
        return super().list(request, *args, **kwargs)


class CourseDetailView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, slug):
        qs = with_stats(Course.objects.all()).select_related("category", "instructor").prefetch_related(
            "tags", "modules__lessons", "modules__quiz"
        )
        course = get_object_or_404(qs, slug=slug)
        user = request.user
        can_preview = user.is_authenticated and (user.role == "admin" or course.instructor_id == user.id)
        if not course.is_published and not can_preview:
            return Response({"detail": "Ce cours n'est pas disponible.", "errors": {}}, status=status.HTTP_404_NOT_FOUND)

        context = {"request": request}
        if _is_learner(request):
            from apps.ml.services import recommendation_detail

            enrollment = Enrollment.objects.filter(user=user, course=course).first()
            if enrollment:
                context["enrollment"] = {
                    "id": enrollment.id,
                    "status": enrollment.status,
                    "progress": enrollment.progress,
                    "next": next_step(user, course),
                    "enrolled_at": enrollment.enrolled_at,
                }
                context["enrolled_ids"] = {course.id}
            context["recommendation"] = recommendation_detail(user, course)
            context["my_review"] = Review.objects.filter(user=user, course=course).first()
            if context["recommendation"]:
                context["match_scores"] = {course.id: context["recommendation"]["score"]}
            record_event(user, "course_view", course=course)
        return Response(CourseDetailSerializer(course, context=context).data)


class EnrollView(APIView):
    permission_classes = [IsLearner]

    def post(self, request, slug):
        course = get_object_or_404(Course.objects.published(), slug=slug)
        enrollment, created = Enrollment.objects.get_or_create(user=request.user, course=course)
        if created:
            record_event(request.user, "enroll", course=course)
            from apps.ml.services import refresh_user_recommendations

            refresh_user_recommendations(request.user)
        data = EnrollmentSerializer(enrollment, context={"request": request}).data
        data["next"] = next_step(request.user, course)
        return Response(data, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)


class ReviewView(APIView):
    permission_classes = [IsLearner]

    def post(self, request, slug):
        course = get_object_or_404(Course.objects.published(), slug=slug)
        if not Enrollment.objects.filter(user=request.user, course=course).exists():
            return Response(
                {"detail": "Inscris-toi au cours avant de donner ton avis.", "errors": {}},
                status=status.HTTP_403_FORBIDDEN,
            )
        serializer = ReviewWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        review, _ = Review.objects.update_or_create(
            user=request.user, course=course, defaults=serializer.validated_data
        )
        return Response(ReviewSerializer(review).data, status=status.HTTP_201_CREATED)
