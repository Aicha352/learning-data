"""Gestion des cours par les formateurs (et les administrateurs)."""
from django.db import transaction
from django.db.models import Max
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import User
from apps.administration.models import ActivityLog
from apps.administration.services import log_activity
from apps.core.permissions import IsInstructorOrAdmin
from apps.engagement.services import notify

from .models import Course, Lesson, Module, Quiz
from .serializers import (
    InstructorCourseDetailSerializer,
    InstructorCourseListSerializer,
    InstructorCourseWriteSerializer,
    LessonWriteSerializer,
    ModuleWriteSerializer,
    QuizReadSerializer,
    QuizWriteSerializer,
)
from .services import can_submit, instructor_courses, with_stats


def check_course_owner(user, course: Course):
    if user.role != "admin" and course.instructor_id != user.id:
        raise PermissionDenied("Ce cours appartient à un autre formateur.")


class InstructorCourseViewSet(viewsets.ModelViewSet):
    permission_classes = [IsInstructorOrAdmin]
    search_fields = ["title", "subtitle"]
    ordering_fields = ["updated_at", "title", "enrolled_count"]
    filterset_fields = ["status", "category"]

    def get_queryset(self):
        return (
            with_stats(instructor_courses(self.request.user))
            .select_related("category", "instructor")
            .prefetch_related("tags")
            .order_by("-updated_at")
        )

    def get_serializer_class(self):
        if self.action in {"create", "update", "partial_update"}:
            return InstructorCourseWriteSerializer
        if self.action == "retrieve":
            return InstructorCourseDetailSerializer
        return InstructorCourseListSerializer

    def _detail(self, course):
        course = self.get_queryset().prefetch_related("modules__lessons", "modules__quiz").get(pk=course.pk)
        return InstructorCourseDetailSerializer(course, context={"request": self.request}).data

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        course = serializer.save()
        log_activity(request.user, ActivityLog.Action.CREATE, f"Nouveau cours « {course.title} »", request, course)
        return Response(self._detail(course), status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop("partial", False)
        course = self.get_object()
        serializer = self.get_serializer(course, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        course = serializer.save()
        log_activity(request.user, ActivityLog.Action.UPDATE, f"Cours « {course.title} » modifié", request, course)
        return Response(self._detail(course))

    def destroy(self, request, *args, **kwargs):
        course = self.get_object()
        if course.enrollments.exists():
            raise ValidationError(
                {"detail": "Ce cours a déjà des apprenants inscrits : il ne peut pas être supprimé."}
            )
        title = course.title
        course.delete()
        log_activity(request.user, ActivityLog.Action.DELETE, f"Cours « {title} » supprimé", request)
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=["post"])
    def submit(self, request, pk=None):
        course = self.get_object()
        if course.status in {Course.Status.PENDING, Course.Status.PUBLISHED}:
            raise ValidationError({"detail": "Ce cours est déjà publié ou en attente de validation."})
        ok, message = can_submit(course)
        if not ok:
            raise ValidationError({"detail": message})
        course.status = Course.Status.PENDING
        course.submitted_at = timezone.now()
        course.save(update_fields=["status", "submitted_at", "updated_at"])
        log_activity(request.user, ActivityLog.Action.UPDATE, f"Cours « {course.title} » soumis pour validation", request, course)
        for admin in User.objects.filter(role=User.Role.ADMIN, status=User.Status.ACTIVE):
            notify(admin, "alert", "Nouveau cours à valider", f"« {course.title} » par {request.user.full_name}", "/admin/validation")
        return Response(self._detail(course))


class _OwnedChildMixin:
    permission_classes = [IsInstructorOrAdmin]

    def course_of(self, obj) -> Course:
        raise NotImplementedError

    def get_object(self):
        obj = super().get_object()
        check_course_owner(self.request.user, self.course_of(obj))
        return obj


class ModuleViewSet(_OwnedChildMixin, mixins.CreateModelMixin, mixins.UpdateModelMixin, mixins.DestroyModelMixin, viewsets.GenericViewSet):
    serializer_class = ModuleWriteSerializer
    queryset = Module.objects.select_related("course")

    def course_of(self, obj):
        return obj.course

    def perform_create(self, serializer):
        course = serializer.validated_data["course"]
        check_course_owner(self.request.user, course)
        next_order = (course.modules.aggregate(m=Max("order"))["m"] or 0) + 1
        serializer.save(order=next_order)

    def perform_update(self, serializer):
        course = serializer.validated_data.get("course", serializer.instance.course)
        check_course_owner(self.request.user, course)
        serializer.save()

    @transaction.atomic
    def perform_destroy(self, instance):
        course = instance.course
        instance.delete()
        for index, module in enumerate(course.modules.order_by("order", "id"), start=1):
            if module.order != index:
                Module.objects.filter(pk=module.pk).update(order=index)

    @action(detail=True, methods=["post"])
    def move(self, request, pk=None):
        module = self.get_object()
        direction = request.data.get("direction")
        siblings = list(module.course.modules.order_by("order", "id"))
        index = siblings.index(module)
        target = index - 1 if direction == "up" else index + 1
        if 0 <= target < len(siblings):
            siblings[index], siblings[target] = siblings[target], siblings[index]
            with transaction.atomic():
                for order, item in enumerate(siblings, start=1):
                    Module.objects.filter(pk=item.pk).update(order=order)
        return Response({"ok": True})

    @action(detail=True, methods=["get", "put", "delete"])
    def quiz(self, request, pk=None):
        module = self.get_object()
        if request.method == "GET":
            quiz = Quiz.objects.filter(module=module).prefetch_related("questions__choices").first()
            return Response(QuizReadSerializer(quiz).data if quiz else None)
        if request.method == "DELETE":
            Quiz.objects.filter(module=module).delete()
            return Response(status=status.HTTP_204_NO_CONTENT)
        serializer = QuizWriteSerializer(data=request.data, context={"module": module, "request": request})
        serializer.is_valid(raise_exception=True)
        quiz = serializer.save_for_module(module)
        quiz = Quiz.objects.prefetch_related("questions__choices").get(pk=quiz.pk)
        return Response(QuizReadSerializer(quiz).data)


class LessonViewSet(_OwnedChildMixin, mixins.CreateModelMixin, mixins.RetrieveModelMixin, mixins.UpdateModelMixin, mixins.DestroyModelMixin, viewsets.GenericViewSet):
    serializer_class = LessonWriteSerializer
    queryset = Lesson.objects.select_related("module__course")

    def course_of(self, obj):
        return obj.module.course

    def perform_create(self, serializer):
        module = serializer.validated_data["module"]
        check_course_owner(self.request.user, module.course)
        next_order = (module.lessons.aggregate(m=Max("order"))["m"] or 0) + 1
        serializer.save(order=next_order)

    def perform_update(self, serializer):
        module = serializer.validated_data.get("module", serializer.instance.module)
        check_course_owner(self.request.user, module.course)
        serializer.save()

    @transaction.atomic
    def perform_destroy(self, instance):
        module = instance.module
        instance.delete()
        for index, lesson in enumerate(module.lessons.order_by("order", "id"), start=1):
            if lesson.order != index:
                Lesson.objects.filter(pk=lesson.pk).update(order=index)

    @action(detail=True, methods=["post"])
    def move(self, request, pk=None):
        lesson = self.get_object()
        direction = request.data.get("direction")
        siblings = list(lesson.module.lessons.order_by("order", "id"))
        index = siblings.index(lesson)
        target = index - 1 if direction == "up" else index + 1
        if 0 <= target < len(siblings):
            siblings[index], siblings[target] = siblings[target], siblings[index]
            with transaction.atomic():
                for order, item in enumerate(siblings, start=1):
                    Lesson.objects.filter(pk=item.pk).update(order=order)
        return Response({"ok": True})


class InstructorCourseLearnersView(APIView):
    """Liste courte des cours pour les filtres (formateur : ses cours publiés)."""

    permission_classes = [IsInstructorOrAdmin]

    def get(self, request):
        courses = instructor_courses(request.user).filter(status=Course.Status.PUBLISHED).order_by("title")
        return Response([{"id": c.id, "title": c.title, "slug": c.slug} for c in courses])


def get_owned_course(user, pk) -> Course:
    course = get_object_or_404(Course, pk=pk)
    check_course_owner(user, course)
    return course
