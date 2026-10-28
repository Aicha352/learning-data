"""Learning analytics pour les formateurs et administrateurs."""
from __future__ import annotations

from collections import Counter, defaultdict
from datetime import timedelta

from django.db.models import Avg, Count, Q
from django.db.models.functions import TruncDate
from django.utils import timezone

from apps.administration.services import get_platform_settings
from apps.core.utils import period_start
from apps.courses.models import Course, Enrollment, Lesson, Module, QuizAttempt
from apps.courses.services import instructor_courses
from apps.engagement.models import Intervention
from apps.ml.dropout import DROPOUT_INACTIVITY_DAYS
from apps.ml.models import DropoutPrediction, LearnerSegment, ModelVersion
from apps.ml.segments import SEGMENT_DESCRIPTIONS
from apps.tracking.models import LearningEvent

LEVEL_LABELS = dict(DropoutPrediction.Level.choices)


def scope_course_ids(user) -> list[int]:
    return list(instructor_courses(user).filter(status=Course.Status.PUBLISHED).values_list("id", flat=True))


def _delta_pct(current: float, previous: float) -> float | None:
    if not previous:
        return None
    return round(100 * (current - previous) / previous, 1)


def top_signals(prediction: DropoutPrediction, n: int = 2) -> list[str]:
    return [c["text"] for c in prediction.contributions if c.get("contribution", 0) > 0][:n]


def overview(user, period: str = "7d") -> dict:
    course_ids = scope_course_ids(user)
    now = timezone.now()
    days = {"7d": 7, "30d": 30, "90d": 90}.get(period, 7)
    start, prev_start = now - timedelta(days=days), now - timedelta(days=2 * days)
    settings = get_platform_settings()

    events = LearningEvent.objects.filter(course_id__in=course_ids)
    active_now = events.filter(created_at__gte=start).values("user_id").distinct().count()
    active_prev = events.filter(created_at__gte=prev_start, created_at__lt=start).values("user_id").distinct().count()

    enrollments = Enrollment.objects.filter(course_id__in=course_ids)
    total = enrollments.count()
    completed = enrollments.filter(status=Enrollment.Status.COMPLETED).count()
    total_before = enrollments.filter(enrolled_at__lt=start).count()
    completed_before = enrollments.filter(completed_at__lt=start).count()
    completion = completed / total if total else 0
    completion_before = completed_before / total_before if total_before else 0

    predictions = DropoutPrediction.objects.filter(course_id__in=course_ids)
    high = predictions.filter(level=DropoutPrediction.Level.HIGH).count()
    high_before = predictions.filter(previous_score__gte=settings.risk_threshold).count()

    attempts = QuizAttempt.objects.filter(quiz__module__course_id__in=course_ids)
    quiz_now = attempts.filter(submitted_at__gte=start).aggregate(a=Avg("score"))["a"]
    quiz_prev = attempts.filter(submitted_at__gte=prev_start, submitted_at__lt=start).aggregate(a=Avg("score"))["a"]

    daily = dict(
        events.filter(created_at__gte=now - timedelta(days=30))
        .annotate(day=TruncDate("created_at"))
        .values("day")
        .annotate(n=Count("user_id", distinct=True))
        .values_list("day", "n")
    )
    today = timezone.localdate()
    daily_series = [
        {"date": (today - timedelta(days=i)).isoformat(), "sessions": daily.get(today - timedelta(days=i), 0)}
        for i in range(29, -1, -1)
    ]

    distribution = dict(predictions.values("level").annotate(n=Count("id")).values_list("level", "n"))
    alerts = predictions.filter(level=DropoutPrediction.Level.HIGH).select_related("user", "course")[:5]

    top = (
        Course.objects.filter(id__in=course_ids)
        .annotate(
            n=Count("enrollments"),
            done=Count("enrollments", filter=Q(enrollments__status=Enrollment.Status.COMPLETED)),
        )
        .order_by("-n")[:5]
    )
    worst_course = (
        predictions.filter(level=DropoutPrediction.Level.HIGH)
        .values("course__title")
        .annotate(n=Count("id"))
        .order_by("-n")
        .first()
    )
    return {
        "period": period,
        "kpis": {
            "active_learners": active_now,
            "active_learners_delta": _delta_pct(active_now, active_prev),
            "completion_rate": round(completion, 3),
            "completion_delta_pts": round(100 * (completion - completion_before), 1) if total_before else None,
            "high_risk": high,
            "high_risk_delta": high - high_before,
            "avg_quiz_score": round(quiz_now, 1) if quiz_now is not None else None,
            "avg_quiz_delta_pts": round(quiz_now - quiz_prev, 1) if quiz_now is not None and quiz_prev is not None else None,
        },
        "daily_sessions": daily_series,
        "risk_distribution": {
            "low": distribution.get("low", 0),
            "medium": distribution.get("medium", 0),
            "high": distribution.get("high", 0),
        },
        "risk_note": (
            f"Surtout dans « {worst_course['course__title']} »." if worst_course else None
        ),
        "alerts": [
            {
                "user": {"id": p.user.id, "name": p.user.full_name, "initials": p.user.initials, "color": p.user.avatar_color},
                "course": {"id": p.course.id, "title": p.course.title},
                "score": round(p.score, 3),
                "level": p.level,
                "signal": (top_signals(p, 1) or [""])[0],
            }
            for p in alerts
        ],
        "top_courses": [
            {"id": c.id, "title": c.title, "slug": c.slug, "enrolled": c.n, "completion_rate": round(c.done / c.n, 3) if c.n else 0}
            for c in top
        ],
    }


def at_risk_queryset(user, params):
    course_ids = scope_course_ids(user)
    qs = DropoutPrediction.objects.filter(course_id__in=course_ids).select_related("user", "course", "enrollment")
    course = params.get("course")
    if course and str(course).isdigit():
        qs = qs.filter(course_id=int(course))
    levels = [lvl for lvl in params.get("level", "high,medium").split(",") if lvl in LEVEL_LABELS]
    if levels:
        qs = qs.filter(level__in=levels)
    query = params.get("q", "").strip()
    if query:
        qs = qs.filter(
            Q(user__first_name__icontains=query) | Q(user__last_name__icontains=query) | Q(user__email__icontains=query)
        )
    ordering = params.get("ordering", "-score")
    allowed = {
        "-score": ["-score"],
        "score": ["score"],
        "last_activity": ["enrollment__last_activity_at"],
        "-progress": ["-enrollment__progress"],
        "progress": ["enrollment__progress"],
        "name": ["user__last_name", "user__first_name"],
    }
    return qs.order_by(*allowed.get(ordering, ["-score"]))


def at_risk_row(p: DropoutPrediction, contacted: set[int]) -> dict:
    return {
        "id": p.id,
        "user": {
            "id": p.user.id,
            "name": p.user.full_name,
            "email": p.user.email,
            "initials": p.user.initials,
            "color": p.user.avatar_color,
        },
        "course": {"id": p.course.id, "title": p.course.title, "slug": p.course.slug},
        "progress": p.enrollment.progress,
        "last_activity_at": p.enrollment.last_activity_at,
        "score": round(p.score, 3),
        "previous_score": round(p.previous_score, 3) if p.previous_score is not None else None,
        "level": p.level,
        "level_label": LEVEL_LABELS[p.level],
        "signals": top_signals(p),
        "contacted_recently": p.user.id in contacted,
    }


def at_risk_summary(user) -> dict:
    course_ids = scope_course_ids(user)
    predictions = DropoutPrediction.objects.filter(course_id__in=course_ids)
    week_ago = timezone.now() - timedelta(days=7)
    month_ago = timezone.now() - timedelta(days=30)
    interventions = Intervention.objects.filter(course_id__in=course_ids)
    recent = interventions.filter(created_at__gte=month_ago).values("learner_id", "created_at")
    returned = 0
    seen = set()
    for item in recent:
        if item["learner_id"] in seen:
            continue
        if LearningEvent.objects.filter(user_id=item["learner_id"], created_at__gt=item["created_at"]).exists():
            returned += 1
            seen.add(item["learner_id"])
    return {
        "high": predictions.filter(level="high").count(),
        "medium": predictions.filter(level="medium").count(),
        "contacted_this_week": interventions.filter(created_at__gte=week_ago).values("learner_id").distinct().count(),
        "returned_after_contact": returned,
    }


def contacted_recently(user_ids) -> set[int]:
    since = timezone.now() - timedelta(days=7)
    return set(
        Intervention.objects.filter(learner_id__in=list(user_ids), created_at__gte=since).values_list("learner_id", flat=True)
    )


def learner_in_scope(instructor, learner_id: int) -> bool:
    if instructor.role == "admin":
        return True
    return Enrollment.objects.filter(user_id=learner_id, course__instructor=instructor).exists()


def learner_file(instructor, learner) -> dict:
    from apps.ml.models import Recommendation

    course_ids = set(scope_course_ids(instructor))
    enrollments = list(
        Enrollment.objects.filter(user=learner).select_related("course", "risk").order_by("-last_activity_at")
    )
    predictions = [e.risk for e in enrollments if getattr(e, "risk", None) is not None and e.course_id in course_ids]
    main = max(predictions, key=lambda p: p.score) if predictions else None

    today = timezone.localdate()
    counts = dict(
        LearningEvent.objects.filter(user=learner, created_at__gte=timezone.now() - timedelta(days=31))
        .annotate(day=TruncDate("created_at"))
        .values("day")
        .annotate(n=Count("id"))
        .values_list("day", "n")
    )
    activity = [{"date": (today - timedelta(days=i)).isoformat(), "count": counts.get(today - timedelta(days=i), 0)} for i in range(29, -1, -1)]
    last_event = LearningEvent.objects.filter(user=learner).order_by("-created_at").first()

    courses = []
    for e in enrollments:
        if e.status == Enrollment.Status.COMPLETED:
            best = QuizAttempt.objects.filter(user=learner, quiz__module__course=e.course).aggregate(a=Avg("score"))["a"]
            detail = f"Terminé · {round(best)} %" if best is not None else "Terminé"
        elif e.progress < 0.1:
            detail = "À peine commencé"
        else:
            from apps.courses.services import next_step

            step = next_step(learner, e.course)
            detail = f"Bloqué au {step['module_title']}" if step and e.last_activity_at and (timezone.now() - e.last_activity_at).days >= 7 else f"En cours · {round(e.progress * 100)} %"
        courses.append(
            {
                "id": e.course.id,
                "title": e.course.title,
                "slug": e.course.slug,
                "progress": e.progress,
                "status": e.status,
                "detail": detail,
                "in_scope": e.course_id in course_ids,
                "risk_level": e.risk.level if getattr(e, "risk", None) else None,
            }
        )

    suggestion = None
    for reco in Recommendation.objects.filter(user=learner, course__status=Course.Status.PUBLISHED).select_related("course").order_by("rank")[:15]:
        minutes = sum(l.duration_minutes for l in Lesson.objects.filter(module__course=reco.course))
        if minutes <= 300:
            suggestion = {"id": reco.course.id, "title": reco.course.title, "slug": reco.course.slug, "duration_minutes": minutes, "score": round(reco.score, 3)}
            break

    interventions = Intervention.objects.filter(learner=learner).select_related("instructor", "notification", "suggested_course")[:10]
    profile = getattr(learner, "profile", None)
    segment = LearnerSegment.objects.filter(user=learner).first()
    return {
        "user": {
            "id": learner.id,
            "name": learner.full_name,
            "email": learner.email,
            "initials": learner.initials,
            "color": learner.avatar_color,
            "date_joined": learner.date_joined,
            "last_activity_at": last_event.created_at if last_event else None,
        },
        "profile": {
            "goal": profile.get_goal_display() if profile and profile.goal else None,
            "level": profile.get_level_display() if profile else None,
            "weekly_hours": profile.get_weekly_hours_display() if profile and profile.weekly_hours else None,
        },
        "segment": {"name": segment.segment, "description": SEGMENT_DESCRIPTIONS.get(segment.segment, "")} if segment else None,
        "risk": {
            "score": round(main.score, 3),
            "level": main.level,
            "level_label": LEVEL_LABELS[main.level],
            "previous_score": main.previous_score,
            "predicted_at": main.predicted_at,
            "course": {"id": main.course_id, "title": main.course.title},
            "contributions": main.contributions,
        }
        if main
        else None,
        "activity": activity,
        "courses": courses,
        "suggestion": suggestion,
        "interventions": [
            {
                "id": i.id,
                "kind": i.kind,
                "kind_label": i.get_kind_display(),
                "message": i.message,
                "instructor": i.instructor.full_name if i.instructor else "—",
                "suggested_course": i.suggested_course.title if i.suggested_course else None,
                "scheduled_for": i.scheduled_for,
                "created_at": i.created_at,
                "is_read": i.is_read,
            }
            for i in interventions
        ],
    }


def course_analytics(user, course_id: int | None, period: str = "90d") -> dict:
    course_ids = scope_course_ids(user)
    options = list(
        Course.objects.filter(id__in=course_ids).annotate(n=Count("enrollments")).order_by("-n").values("id", "title", "n")
    )
    if not options:
        return {"courses": [], "course": None}
    if course_id not in course_ids:
        course_id = options[0]["id"]
    course = Course.objects.get(pk=course_id)
    start = period_start(period)
    now = timezone.now()

    enrollments = Enrollment.objects.filter(course=course)
    if start:
        enrollments = enrollments.filter(enrolled_at__gte=start)
    learner_ids = list(enrollments.values_list("user_id", flat=True))
    enrolled = len(learner_ids)

    modules = list(Module.objects.filter(course=course).order_by("order"))
    opened = (
        LearningEvent.objects.filter(course=course, user_id__in=learner_ids, event_type="lesson_open", lesson__isnull=False)
        .values_list("user_id", "lesson__module_id")
        .distinct()
    )
    reached = defaultdict(set)
    for user_id, module_id in opened:
        reached[module_id].add(user_id)
    funnel = [{"label": "Inscrits", "value": enrolled}]
    for module in modules:
        funnel.append({"label": f"Module {module.order}", "value": len(reached.get(module.id, set()))})
    funnel.append({"label": "Certificat", "value": enrollments.filter(status=Enrollment.Status.COMPLETED).count()})
    biggest = None
    for a, b in zip(funnel, funnel[1:]):
        if a["value"]:
            drop = (a["value"] - b["value"]) / a["value"]
            if biggest is None or drop > biggest[0]:
                biggest = (drop, a["label"], b["label"])

    cutoff = now - timedelta(days=DROPOUT_INACTIVITY_DAYS)
    dropped = enrollments.filter(status=Enrollment.Status.ACTIVE, last_activity_at__lt=cutoff)
    weeks = Counter()
    for enrolled_at, last in dropped.values_list("enrolled_at", "last_activity_at"):
        week = min(8, max(1, int((last - enrolled_at).days // 7) + 1))
        weeks[week] += 1
    dropoff = [{"label": f"S{w}", "value": weeks.get(w, 0)} for w in range(1, 9)]
    peak = max(dropoff, key=lambda d: d["value"]) if any(d["value"] for d in dropoff) else None

    # Leçons où les apprenants se sont arrêtés (inactifs depuis 14 jours sans avoir terminé).
    stopped = enrollments.filter(status=Enrollment.Status.ACTIVE, last_activity_at__lt=now - timedelta(days=14))
    dropped_users = set(stopped.values_list("user_id", flat=True))
    last_lesson = {}
    for user_id, lesson_id, created in (
        LearningEvent.objects.filter(course=course, user_id__in=dropped_users, event_type="lesson_open", lesson__isnull=False)
        .order_by("created_at")
        .values_list("user_id", "lesson_id", "created_at")
    ):
        last_lesson[user_id] = lesson_id
    exits = Counter(last_lesson.values())
    viewers = dict(
        LearningEvent.objects.filter(course=course, user_id__in=learner_ids, event_type="lesson_open", lesson__isnull=False)
        .values("lesson_id")
        .annotate(n=Count("user_id", distinct=True))
        .values_list("lesson_id", "n")
    )
    seeks = dict(
        LearningEvent.objects.filter(course=course, user_id__in=learner_ids, event_type="video_seek", lesson__isnull=False)
        .values("lesson_id")
        .annotate(n=Count("id"))
        .values_list("lesson_id", "n")
    )
    quiz_avg = dict(
        QuizAttempt.objects.filter(quiz__module__course=course, user_id__in=learner_ids)
        .values("quiz__module_id")
        .annotate(a=Avg("score"))
        .values_list("quiz__module_id", "a")
    )
    lessons = []
    for lesson in Lesson.objects.filter(module__course=course).select_related("module"):
        n = viewers.get(lesson.id, 0)
        if not n:
            continue
        exit_rate = exits.get(lesson.id, 0) / n
        status = "rework" if exit_rate >= 0.15 else "watch" if exit_rate >= 0.08 else "ok"
        lessons.append(
            {
                "id": lesson.id,
                "title": lesson.title,
                "module": f"Module {lesson.module.order}",
                "viewers": n,
                "exit_rate": round(exit_rate, 3),
                "replays": round(seeks.get(lesson.id, 0) / n, 1),
                "quiz_avg": round(quiz_avg[lesson.module_id], 1) if quiz_avg.get(lesson.module_id) is not None else None,
                "status": status,
                "status_label": {"rework": "À retravailler", "watch": "À surveiller", "ok": "Correct"}[status],
            }
        )
    lessons.sort(key=lambda l: -l["exit_rate"])

    segments_count = Counter(LearnerSegment.objects.filter(user_id__in=learner_ids).values_list("segment", flat=True))
    risk_by_segment = defaultdict(list)
    for segment, score in DropoutPrediction.objects.filter(course=course, user__segment__isnull=False).values_list("user__segment__segment", "score"):
        risk_by_segment[segment].append(score)
    settings = get_platform_settings()
    total_seg = sum(segments_count.values())
    segments = []
    for name in ["Réguliers", "Week-end", "Pressés", "Décrocheurs potentiels"]:
        scores = risk_by_segment.get(name, [])
        avg = sum(scores) / len(scores) if scores else None
        level = None if avg is None else "high" if avg >= settings.risk_threshold else "medium" if avg >= settings.medium_risk_threshold else "low"
        if level is None:
            level = "high" if name == "Décrocheurs potentiels" else "medium" if name == "Pressés" else "low"
        segments.append(
            {
                "name": name,
                "count": segments_count.get(name, 0),
                "share": round(segments_count.get(name, 0) / total_seg, 3) if total_seg else 0,
                "description": SEGMENT_DESCRIPTIONS[name],
                "risk_level": level,
            }
        )
    seg_version = ModelVersion.objects.filter(kind=ModelVersion.Kind.SEGMENTS, is_active=True).first()

    return {
        "courses": [{"id": o["id"], "title": o["title"], "enrolled": o["n"]} for o in options],
        "course": {"id": course.id, "title": course.title, "slug": course.slug},
        "period": period,
        "funnel": funnel,
        "funnel_note": (
            f"−{round(biggest[0] * 100)} % entre « {biggest[1]} » et « {biggest[2]} » : la plus grosse perte du cours."
            if biggest and biggest[0] > 0
            else None
        ),
        "dropoff": dropoff,
        "dropoff_note": f"Pic d'abandon en semaine {peak['label'][1:]}." if peak else None,
        "segments": segments,
        "segments_trained_at": seg_version.trained_at if seg_version else None,
        "lessons": lessons[:8],
    }
