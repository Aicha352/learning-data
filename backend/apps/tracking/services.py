"""Enregistrement des événements d'apprentissage (collecte des données)."""
from django.utils import timezone

from .models import LearningEvent

VIDEO_TYPES = {
    LearningEvent.Type.VIDEO_PLAY,
    LearningEvent.Type.VIDEO_PAUSE,
    LearningEvent.Type.VIDEO_SEEK,
    LearningEvent.Type.VIDEO_PROGRESS,
    LearningEvent.Type.VIDEO_COMPLETE,
}


def record_event(user, event_type: str, course=None, lesson=None, value=None, metadata=None, session_id: str = ""):
    """Enregistre un événement et met à jour la date de dernière activité de l'inscription."""
    if lesson is not None and course is None:
        course = lesson.module.course
    event = LearningEvent.objects.create(
        user=user,
        event_type=event_type,
        course=course,
        lesson=lesson,
        value=value,
        metadata=metadata or {},
        session_id=session_id[:64],
    )
    if course is not None:
        touch_enrollment(user, course, event.created_at)
    return event


def touch_enrollment(user, course, when=None):
    from apps.courses.models import Enrollment

    Enrollment.objects.filter(user=user, course=course).update(last_activity_at=when or timezone.now())
