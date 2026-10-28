from django.db import transaction
from django.db.models import F
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from apps.courses.models import Enrollment, Lesson, LessonProgress

from .models import LearningEvent
from .serializers import EventBatchSerializer, LearningEventSerializer


class EventIngestView(APIView):
    """Reçoit un lot d'événements envoyés par le navigateur (collecte des données)."""

    permission_classes = [IsAuthenticated]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "events"

    def post(self, request):
        serializer = EventBatchSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = request.user
        incoming = serializer.validated_data["events"]

        lesson_ids = {e.get("lesson") for e in incoming if e.get("lesson")}
        lessons = {
            lesson.id: lesson
            for lesson in Lesson.objects.filter(id__in=lesson_ids).select_related("module__course")
        }
        enrolled_course_ids = set(Enrollment.objects.filter(user=user).values_list("course_id", flat=True))

        now = timezone.now()
        to_create, touched_courses = [], set()
        progress_updates: dict[int, dict] = {}
        for item in incoming:
            lesson = lessons.get(item.get("lesson"))
            course_id = lesson.module.course_id if lesson else item.get("course")
            if lesson and course_id not in enrolled_course_ids:
                continue  # on ignore les leçons d'un cours non suivi
            to_create.append(
                LearningEvent(
                    user=user,
                    event_type=item["event_type"],
                    course_id=course_id,
                    lesson=lesson,
                    value=item.get("value"),
                    metadata=item.get("metadata") or {},
                    session_id=item.get("session_id", ""),
                    created_at=now,
                )
            )
            if course_id in enrolled_course_ids:
                touched_courses.add(course_id)
            if lesson and item["event_type"] == LearningEvent.Type.VIDEO_PROGRESS:
                update = progress_updates.setdefault(lesson.id, {"seconds": 0, "position": 0})
                update["seconds"] += max(0, int(item.get("value") or 0))
                update["position"] = int((item.get("metadata") or {}).get("position", 0) or 0)

        with transaction.atomic():
            LearningEvent.objects.bulk_create(to_create)
            if touched_courses:
                Enrollment.objects.filter(user=user, course_id__in=touched_courses).update(last_activity_at=now)
            for lesson_id, update in progress_updates.items():
                progress, _ = LessonProgress.objects.get_or_create(user=user, lesson_id=lesson_id)
                LessonProgress.objects.filter(pk=progress.pk).update(
                    watched_seconds=F("watched_seconds") + update["seconds"],
                    last_position_seconds=max(0, update["position"]),
                )
        return Response({"accepted": len(to_create)}, status=status.HTTP_201_CREATED)


class RecentEventsView(APIView):
    """Derniers événements de l'utilisateur (panneau « Collecte des données » de la leçon)."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        qs = LearningEvent.objects.filter(user=request.user)
        lesson = request.query_params.get("lesson")
        if lesson and lesson.isdigit():
            qs = qs.filter(lesson_id=int(lesson))
        return Response(LearningEventSerializer(qs[:12], many=True).data)
