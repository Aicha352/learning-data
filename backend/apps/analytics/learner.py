"""Indicateurs personnels de l'apprenant : tableau de bord et progression."""
from __future__ import annotations

from datetime import timedelta

from django.db.models import Avg, Sum
from django.db.models.functions import TruncDate
from django.utils import timezone

from apps.accounts.models import LearnerProfile
from apps.administration.services import get_platform_settings
from apps.courses.models import Course, Enrollment, LessonProgress, QuizAttempt
from apps.courses.services import next_step
from apps.ml.models import DropoutPrediction, LearnerSegment
from apps.ml.segments import SEGMENT_DESCRIPTIONS
from apps.tracking.models import LearningEvent

TIME_EVENTS = ["video_progress", "lesson_time"]
LEVEL_LABELS = dict(DropoutPrediction.Level.choices)
LEVEL_ORDER = {"low": 0, "medium": 1, "high": 2}


def minutes_between(user, start, end=None) -> int:
    qs = LearningEvent.objects.filter(user=user, event_type__in=TIME_EVENTS, created_at__gte=start)
    if end is not None:
        qs = qs.filter(created_at__lt=end)
    seconds = qs.aggregate(s=Sum("value"))["s"] or 0
    return int(round(seconds / 60))


def streak_days(user) -> int:
    today = timezone.localdate()
    days = set(
        LearningEvent.objects.filter(user=user, created_at__gte=timezone.now() - timedelta(days=90))
        .annotate(day=TruncDate("created_at"))
        .values_list("day", flat=True)
        .distinct()
    )
    cursor = today if today in days else today - timedelta(days=1)
    streak = 0
    while cursor in days:
        streak += 1
        cursor -= timedelta(days=1)
    return streak


def course_card(enrollment: Enrollment) -> dict:
    course = enrollment.course
    risk = getattr(enrollment, "risk", None)
    return {
        "enrollment_id": enrollment.id,
        "course": {
            "id": course.id,
            "slug": course.slug,
            "title": course.title,
            "cover_color": course.cover_color,
            "category": course.category.name,
            "category_color": course.category.color,
        },
        "progress": enrollment.progress,
        "status": enrollment.status,
        "last_activity_at": enrollment.last_activity_at,
        "next": next_step(enrollment.user_id, course) if enrollment.status == Enrollment.Status.ACTIVE else None,
        "risk_level": risk.level if risk else None,
    }


def dashboard(user) -> dict:
    now = timezone.now()
    settings = get_platform_settings()
    active = list(
        Enrollment.objects.filter(user=user, status=Enrollment.Status.ACTIVE)
        .select_related("course__category", "risk")
        .order_by("-last_activity_at")
    )
    nudge = None
    inactive = [
        e for e in active if e.last_activity_at and (now - e.last_activity_at).days >= settings.inactivity_days
    ]
    if inactive:
        e = max(inactive, key=lambda x: now - x.last_activity_at)
        step = next_step(user, e.course)
        nudge = {
            "course": {"slug": e.course.slug, "title": e.course.title},
            "days": (now - e.last_activity_at).days,
            "progress": e.progress,
            "next": step,
        }
    profile = LearnerProfile.objects.filter(user=user).first()
    return {
        "kpis": {
            "courses_in_progress": len(active),
            "lessons_completed": LessonProgress.objects.filter(user=user, completed=True).count(),
            "minutes_this_week": minutes_between(user, now - timedelta(days=7)),
            "streak_days": streak_days(user),
        },
        "nudge": nudge,
        "continue": [course_card(e) for e in active[:3]],
        "completed_count": Enrollment.objects.filter(user=user, status=Enrollment.Status.COMPLETED).count(),
        "onboarding_completed": bool(profile and profile.onboarding_completed),
    }


def progress_report(user) -> dict:
    now = timezone.now()
    enrollments = list(
        Enrollment.objects.filter(user=user).select_related("course__category", "risk").order_by("enrolled_at")
    )
    attempts = list(
        QuizAttempt.objects.filter(user=user).select_related("quiz").order_by("-submitted_at")[:8]
    )[::-1]
    avg_quiz = QuizAttempt.objects.filter(user=user).aggregate(a=Avg("score"))["a"]

    # Temps d'étude des 8 dernières semaines.
    weeks = []
    for i in range(8, 0, -1):
        start = now - timedelta(days=7 * i)
        end = start + timedelta(days=7)
        weeks.append({"label": f"S{9 - i}", "start": start.date(), "minutes": minutes_between(user, start, end)})
    note = None
    if len(weeks) >= 3:
        mean = sum(w["minutes"] for w in weeks) / len(weeks)
        dips = [w for w in weeks[:-1] if mean > 0 and w["minutes"] < 0.5 * mean]
        if dips:
            note = f"Baisse d'activité détectée en semaine {dips[-1]['label'][1:]} : un rappel t'a été envoyé."

    risks = [e.risk for e in enrollments if getattr(e, "risk", None) is not None]
    worst = max(risks, key=lambda r: r.score) if risks else None

    skills: dict[str, dict] = {}
    for e in enrollments:
        cat = e.course.category
        entry = skills.setdefault(cat.name, {"name": cat.name, "color": cat.color, "total": 0.0, "count": 0})
        entry["total"] += e.progress
        entry["count"] += 1
    skill_list = [
        {"name": s["name"], "color": s["color"], "value": round(s["total"] / s["count"], 3)} for s in skills.values()
    ]
    skill_list.sort(key=lambda s: -s["value"])

    path = []
    for e in enrollments:
        if e.status == Enrollment.Status.COMPLETED:
            best = (
                QuizAttempt.objects.filter(user=user, quiz__module__course=e.course).aggregate(a=Avg("score"))["a"]
            )
            detail = f"Terminé · {round(best)} %" if best is not None else "Terminé"
            status = "done"
        else:
            detail = f"En cours · {round(e.progress * 100)} %"
            status = "now"
        path.append({"title": e.course.title, "slug": e.course.slug, "status": status, "detail": detail})
    from apps.ml.models import Recommendation

    next_reco = Recommendation.objects.filter(user=user, course__status=Course.Status.PUBLISHED).select_related("course").order_by("rank").first()
    if next_reco:
        path.append({"title": next_reco.course.title, "slug": next_reco.course.slug, "status": "todo", "detail": "Recommandé ensuite"})
    profile = LearnerProfile.objects.filter(user=user).first()
    segment = LearnerSegment.objects.filter(user=user).first()
    return {
        "goal": profile.get_goal_display() if profile and profile.goal else None,
        "kpis": {
            "total_minutes": minutes_between(user, now - timedelta(days=3650)),
            "completed_courses": sum(1 for e in enrollments if e.status == Enrollment.Status.COMPLETED),
            "enrolled_courses": len(enrollments),
            "avg_quiz_score": round(avg_quiz, 1) if avg_quiz is not None else None,
            "risk_level": worst.level if worst else "low",
            "risk_label": LEVEL_LABELS[worst.level] if worst else "Faible",
        },
        "weekly_minutes": weeks,
        "weekly_note": note,
        "quiz_scores": [
            {"label": f"Q{i + 1}", "score": a.score, "quiz": a.quiz.title, "date": a.submitted_at} for i, a in enumerate(attempts)
        ],
        "skills": skill_list,
        "path": path,
        "segment": {"name": segment.segment, "description": SEGMENT_DESCRIPTIONS.get(segment.segment, "")} if segment else None,
    }
