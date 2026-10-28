from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from rest_framework import serializers, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import User
from apps.administration.models import ActivityLog
from apps.administration.services import log_activity
from apps.core.pagination import StandardPagination
from apps.core.permissions import IsInstructorOrAdmin, IsLearner
from apps.core.utils import csv_response
from apps.courses.models import Course
from apps.engagement.models import Intervention
from apps.engagement.services import create_intervention

from . import instructor, learner


class LearnerDashboardView(APIView):
    permission_classes = [IsLearner]

    def get(self, request):
        return Response(learner.dashboard(request.user))


class LearnerProgressView(APIView):
    permission_classes = [IsLearner]

    def get(self, request):
        return Response(learner.progress_report(request.user))


class InstructorOverviewView(APIView):
    permission_classes = [IsInstructorOrAdmin]

    def get(self, request):
        return Response(instructor.overview(request.user, request.query_params.get("period", "7d")))


class AtRiskListView(APIView):
    permission_classes = [IsInstructorOrAdmin]

    def get(self, request):
        qs = instructor.at_risk_queryset(request.user, request.query_params)
        if request.query_params.get("export") == "csv":
            rows = list(qs[:5000])
            contacted = instructor.contacted_recently({p.user_id for p in rows})
            data = [instructor.at_risk_row(p, contacted) for p in rows]
            return csv_response(
                "apprenants-a-risque.csv",
                ["Apprenant", "E-mail", "Cours", "Progression (%)", "Dernière activité", "Score de risque (%)", "Niveau", "Signaux"],
                [
                    [
                        r["user"]["name"],
                        r["user"]["email"],
                        r["course"]["title"],
                        round(r["progress"] * 100),
                        timezone.localtime(r["last_activity_at"]).strftime("%d/%m/%Y") if r["last_activity_at"] else "",
                        round(r["score"] * 100),
                        r["level_label"],
                        " ; ".join(r["signals"]),
                    ]
                    for r in data
                ],
            )
        paginator = StandardPagination()
        paginator.page_size = 10
        page = paginator.paginate_queryset(qs, request, view=self)
        contacted = instructor.contacted_recently({p.user_id for p in page})
        response = paginator.get_paginated_response([instructor.at_risk_row(p, contacted) for p in page])
        response.data["summary"] = instructor.at_risk_summary(request.user)
        return response


class InterventionSerializer(serializers.Serializer):
    kind = serializers.ChoiceField(choices=Intervention.Kind.choices)
    message = serializers.CharField(max_length=2000)
    course = serializers.PrimaryKeyRelatedField(queryset=Course.objects.all(), required=False, allow_null=True)
    suggested_course = serializers.PrimaryKeyRelatedField(
        queryset=Course.objects.published(), required=False, allow_null=True
    )
    scheduled_for = serializers.CharField(required=False, allow_blank=True, allow_null=True)

    def validate_scheduled_for(self, value):
        if not value:
            return None
        parsed = parse_datetime(value)
        if parsed is None:
            raise serializers.ValidationError("Date invalide.")
        if timezone.is_naive(parsed):
            parsed = timezone.make_aware(parsed)
        if parsed < timezone.now():
            raise serializers.ValidationError("Choisis une date dans le futur.")
        return parsed

    def validate(self, attrs):
        if attrs["kind"] == Intervention.Kind.COURSE_SUGGESTION and not attrs.get("suggested_course"):
            raise serializers.ValidationError({"suggested_course": "Choisis le cours à suggérer."})
        if attrs["kind"] == Intervention.Kind.TUTORING and not attrs.get("scheduled_for"):
            raise serializers.ValidationError({"scheduled_for": "Indique la date du tutorat."})
        return attrs


class LearnerFileView(APIView):
    permission_classes = [IsInstructorOrAdmin]

    def _learner(self, request, pk):
        learner_user = get_object_or_404(User, pk=pk, role=User.Role.LEARNER)
        if not instructor.learner_in_scope(request.user, learner_user.id):
            return None
        return learner_user

    def get(self, request, pk):
        learner_user = self._learner(request, pk)
        if learner_user is None:
            return Response({"detail": "Cet apprenant ne suit aucun de tes cours.", "errors": {}}, status=status.HTTP_403_FORBIDDEN)
        return Response(instructor.learner_file(request.user, learner_user))


class InterventionCreateView(LearnerFileView):
    http_method_names = ["post", "options"]

    def post(self, request, pk):
        learner_user = self._learner(request, pk)
        if learner_user is None:
            return Response({"detail": "Cet apprenant ne suit aucun de tes cours.", "errors": {}}, status=status.HTTP_403_FORBIDDEN)
        serializer = InterventionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        intervention = create_intervention(
            request.user,
            learner_user,
            data["kind"],
            data["message"],
            course=data.get("course"),
            suggested_course=data.get("suggested_course"),
            scheduled_for=data.get("scheduled_for"),
        )
        log_activity(
            request.user,
            ActivityLog.Action.CREATE,
            f"{intervention.get_kind_display()} envoyé à {learner_user.full_name}",
            request,
            intervention,
        )
        return Response({"id": intervention.id, "detail": "Message envoyé à l'apprenant."}, status=status.HTTP_201_CREATED)


class CourseAnalyticsView(APIView):
    permission_classes = [IsInstructorOrAdmin]

    def get(self, request):
        course = request.query_params.get("course")
        course_id = int(course) if course and course.isdigit() else None
        return Response(instructor.course_analytics(request.user, course_id, request.query_params.get("period", "90d")))
