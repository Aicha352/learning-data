"""Chargement des données d'apprentissage depuis PostgreSQL vers des structures numpy/pandas."""
from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np
import pandas as pd
from django.db.models import Count

from apps.accounts.models import LearnerProfile, User
from apps.courses.models import Course, Enrollment, Lesson, LessonProgress, Quiz, QuizAttempt, Review

from .models import RecommendationFeedback


@dataclass
class CourseInfo:
    id: int
    title: str
    slug: str
    level: str
    category_slug: str
    category_name: str
    category_color: str
    tags: list[str]
    text: str
    duration_minutes: int
    enrolled_count: int = 0
    published_at: object = None


@dataclass
class Catalog:
    courses: list[CourseInfo]
    index: dict[int, int] = field(default_factory=dict)

    def __post_init__(self):
        self.index = {c.id: i for i, c in enumerate(self.courses)}

    @property
    def ids(self) -> list[int]:
        return [c.id for c in self.courses]

    def get(self, course_id: int) -> CourseInfo | None:
        i = self.index.get(course_id)
        return self.courses[i] if i is not None else None


def load_catalog(published_only: bool = True) -> Catalog:
    qs = Course.objects.select_related("category").prefetch_related("tags", "modules__lessons")
    if published_only:
        qs = qs.filter(status=Course.Status.PUBLISHED)
    counts = dict(Enrollment.objects.values("course_id").annotate(c=Count("id")).values_list("course_id", "c"))
    courses = []
    for course in qs.order_by("id"):
        tags = [t.name for t in course.tags.all()]
        modules = list(course.modules.all())
        lessons = [lesson for module in modules for lesson in module.lessons.all()]
        text = " ".join(
            [
                course.title,
                course.title,
                course.subtitle,
                course.description,
                " ".join(tags * 2),
                course.category.name,
                course.get_level_display(),
                " ".join(m.title for m in modules),
                " ".join(l.title for l in lessons),
            ]
        )
        courses.append(
            CourseInfo(
                id=course.id,
                title=course.title,
                slug=course.slug,
                level=course.level,
                category_slug=course.category.slug,
                category_name=course.category.name,
                category_color=course.category.color,
                tags=tags,
                text=text,
                duration_minutes=sum(l.duration_minutes for l in lessons),
                enrolled_count=counts.get(course.id, 0),
                published_at=course.published_at,
            )
        )
    return Catalog(courses)


@dataclass
class LearnerInfo:
    id: int
    goal: str
    level: str
    interests: list[str]


def load_profiles(user_ids=None) -> dict[int, LearnerInfo]:
    qs = LearnerProfile.objects.select_related("user").prefetch_related("interests")
    if user_ids is not None:
        qs = qs.filter(user_id__in=list(user_ids))
    return {
        p.user_id: LearnerInfo(p.user_id, p.goal, p.level, [t.name for t in p.interests.all()]) for p in qs
    }


def interaction_weight(progress: float, completed: bool, rating: int | None) -> float:
    """Intensité de l'intérêt d'un apprenant pour un cours (feedback implicite + note)."""
    weight = 1.0 + 0.5 * float(progress or 0.0) + (0.5 if completed else 0.0)
    if rating:
        weight += (rating - 3) * 0.25
    return max(0.1, weight)


def load_interactions(user_ids=None) -> pd.DataFrame:
    """Une ligne par inscription : user_id, course_id, weight, enrolled_at."""
    qs = Enrollment.objects.filter(user__role=User.Role.LEARNER)
    if user_ids is not None:
        qs = qs.filter(user_id__in=list(user_ids))
    rows = list(qs.values("user_id", "course_id", "progress", "status", "enrolled_at"))
    ratings = {
        (r["user_id"], r["course_id"]): r["rating"]
        for r in Review.objects.filter(user_id__in={r["user_id"] for r in rows}).values("user_id", "course_id", "rating")
    } if rows else {}
    for row in rows:
        row["weight"] = interaction_weight(
            row["progress"], row["status"] == Enrollment.Status.COMPLETED, ratings.get((row["user_id"], row["course_id"]))
        )
    df = pd.DataFrame(rows, columns=["user_id", "course_id", "progress", "status", "enrolled_at", "weight"])
    return df


def load_dismissed(user_ids=None) -> dict[int, set[int]]:
    qs = RecommendationFeedback.objects.filter(action=RecommendationFeedback.Action.DISMISSED)
    if user_ids is not None:
        qs = qs.filter(user_id__in=list(user_ids))
    result: dict[int, set[int]] = {}
    for user_id, course_id in qs.values_list("user_id", "course_id"):
        result.setdefault(user_id, set()).add(course_id)
    return result


def load_activity_frames():
    """Charge les tables utiles au modèle d'abandon sous forme de DataFrames."""
    from apps.tracking.models import LearningEvent

    events = pd.DataFrame(
        list(
            LearningEvent.objects.filter(course__isnull=False, user__role=User.Role.LEARNER).values_list(
                "user_id", "course_id", "event_type", "value", "created_at"
            )
        ),
        columns=["user_id", "course_id", "event_type", "value", "created_at"],
    )
    enrollments = pd.DataFrame(
        list(
            Enrollment.objects.filter(user__role=User.Role.LEARNER).values_list(
                "id", "user_id", "course_id", "status", "enrolled_at", "completed_at", "last_activity_at"
            )
        ),
        columns=["id", "user_id", "course_id", "status", "enrolled_at", "completed_at", "last_activity_at"],
    )
    completions = pd.DataFrame(
        list(
            LessonProgress.objects.filter(completed=True, completed_at__isnull=False).values_list(
                "user_id", "lesson__module__course_id", "completed_at"
            )
        ),
        columns=["user_id", "course_id", "completed_at"],
    )
    attempts = pd.DataFrame(
        list(
            QuizAttempt.objects.values_list(
                "user_id", "quiz__module__course_id", "quiz_id", "score", "passed", "submitted_at"
            )
        ),
        columns=["user_id", "course_id", "quiz_id", "score", "passed", "submitted_at"],
    )
    lesson_counts = dict(
        Lesson.objects.values("module__course_id").annotate(c=Count("id")).values_list("module__course_id", "c")
    )
    quiz_counts = dict(
        Quiz.objects.values("module__course_id").annotate(c=Count("id")).values_list("module__course_id", "c")
    )
    for frame, column in ((events, "created_at"), (completions, "completed_at"), (attempts, "submitted_at")):
        frame[column] = pd.to_datetime(frame[column], utc=True)
    for column in ("enrolled_at", "completed_at", "last_activity_at"):
        enrollments[column] = pd.to_datetime(enrollments[column], utc=True)
    return {
        "events": events,
        "enrollments": enrollments,
        "completions": completions,
        "attempts": attempts,
        "lesson_counts": lesson_counts,
        "quiz_counts": quiz_counts,
    }


EPOCH = pd.Timestamp("1970-01-01", tz="UTC")


def to_epoch(series: pd.Series) -> np.ndarray:
    """Convertit des dates (avec fuseau) en secondes depuis 1970, quelle que soit la résolution pandas."""
    if not len(series):
        return np.array([], dtype=float)
    return ((series - EPOCH) / pd.Timedelta(seconds=1)).to_numpy(dtype=float)
