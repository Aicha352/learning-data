"""Logique métier des cours : statistiques, progression, validation."""
from django.db.models import Avg, Count, FloatField, IntegerField, OuterRef, Q, Subquery, Sum
from django.db.models.functions import Coalesce
from django.utils import timezone

from .models import Course, Enrollment, Lesson, LessonProgress, Module, Quiz, QuizAttempt, Review


def _count_subquery(qs, group_field: str):
    return Coalesce(
        Subquery(qs.values(group_field).annotate(c=Count("id")).values("c")[:1], output_field=IntegerField()),
        0,
    )


def with_stats(queryset):
    """Ajoute aux cours : inscrits, terminés, note moyenne, nombre de leçons et durée totale."""
    enrollments = Enrollment.objects.filter(course=OuterRef("pk"))
    reviews = Review.objects.filter(course=OuterRef("pk"))
    lessons = Lesson.objects.filter(module__course=OuterRef("pk"))
    return queryset.annotate(
        enrolled_count=_count_subquery(enrollments, "course"),
        completed_count=_count_subquery(enrollments.filter(status=Enrollment.Status.COMPLETED), "course"),
        review_count=_count_subquery(reviews, "course"),
        avg_rating=Subquery(
            reviews.values("course").annotate(a=Avg("rating")).values("a")[:1], output_field=FloatField()
        ),
        lesson_count=_count_subquery(lessons, "module__course"),
        total_minutes=Coalesce(
            Subquery(
                lessons.values("module__course").annotate(s=Sum("duration_minutes")).values("s")[:1],
                output_field=IntegerField(),
            ),
            0,
        ),
    )


def ordered_lessons(course) -> list[Lesson]:
    return list(
        Lesson.objects.filter(module__course=course).select_related("module").order_by("module__order", "module_id", "order", "id")
    )


def completed_lesson_ids(user, course) -> set[int]:
    return set(
        LessonProgress.objects.filter(user=user, lesson__module__course=course, completed=True).values_list(
            "lesson_id", flat=True
        )
    )


def passed_quiz_ids(user, course) -> set[int]:
    return set(
        QuizAttempt.objects.filter(user=user, quiz__module__course=course, passed=True).values_list("quiz_id", flat=True)
    )


def next_step(user, course) -> dict | None:
    """Prochaine étape conseillée : la première leçon non terminée, sinon le premier quiz non réussi."""
    done = completed_lesson_ids(user, course)
    for lesson in ordered_lessons(course):
        if lesson.id not in done:
            return {"type": "lesson", "id": lesson.id, "title": lesson.title, "module_title": lesson.module.title}
    passed = passed_quiz_ids(user, course)
    for quiz in Quiz.objects.filter(module__course=course).select_related("module").order_by("module__order"):
        if quiz.id not in passed:
            return {"type": "quiz", "id": quiz.id, "title": quiz.title, "module_title": quiz.module.title}
    return None


def recompute_progress(enrollment: Enrollment) -> Enrollment:
    """Met à jour la progression (leçons terminées + quiz réussis) et termine le cours si tout est fait."""
    course = enrollment.course
    lesson_total = Lesson.objects.filter(module__course=course).count()
    quiz_total = Quiz.objects.filter(module__course=course).count()
    done = len(completed_lesson_ids(enrollment.user, course))
    passed = len(passed_quiz_ids(enrollment.user, course))
    total = lesson_total + quiz_total
    enrollment.progress = round((done + passed) / total, 4) if total else 0.0
    just_completed = False
    if total and done >= lesson_total and passed >= quiz_total and enrollment.status != Enrollment.Status.COMPLETED:
        enrollment.status = Enrollment.Status.COMPLETED
        enrollment.completed_at = timezone.now()
        just_completed = True
    enrollment.last_activity_at = timezone.now()
    enrollment.save(update_fields=["progress", "status", "completed_at", "last_activity_at"])
    if just_completed:
        _on_course_completed(enrollment)
    return enrollment


def _on_course_completed(enrollment: Enrollment):
    from apps.administration.services import get_platform_settings
    from apps.engagement.services import notify

    notify(
        enrollment.user,
        "achievement",
        f"Bravo ! Tu as terminé « {enrollment.course.title} »",
        "Ton certificat est disponible.",
        f"/apprenant/certificats/{enrollment.course.slug}",
        send_email=get_platform_settings().email_completion_congrats,
    )
    from apps.ml.models import DropoutPrediction

    DropoutPrediction.objects.filter(enrollment=enrollment).delete()


def course_checklist(course: Course) -> list[dict]:
    """Vérifications automatiques avant publication d'un cours."""
    modules = list(Module.objects.filter(course=course).prefetch_related("lessons", "quiz__questions__choices"))
    checks = []

    def add(key, label, ok, detail=""):
        checks.append({"key": key, "label": label, "ok": bool(ok), "detail": detail})

    add("description", "Description complète (80 caractères minimum)", len(course.description.strip()) >= 80)
    add("outcomes", "Au moins 2 objectifs d'apprentissage", len([o for o in course.learning_outcomes if str(o).strip()]) >= 2)
    add("modules", f"Au moins 2 modules ({len(modules)} module{'s' if len(modules) > 1 else ''})", len(modules) >= 2)

    empty_modules = [m for m in modules if not m.lessons.all()]
    add(
        "lessons",
        "Chaque module contient au moins une leçon",
        modules and not empty_modules,
        ", ".join(f"module {m.order}" for m in empty_modules),
    )
    empty_lessons = [l for m in modules for l in m.lessons.all() if not l.content.strip() and not l.video_url]
    add("content", "Chaque leçon a un contenu ou une vidéo", modules and not empty_lessons, f"{len(empty_lessons)} leçon(s) vide(s)" if empty_lessons else "")

    missing_quiz = []
    for module in modules:
        quiz = getattr(module, "quiz", None)
        questions = list(quiz.questions.all()) if quiz else []
        valid = len(questions) >= 2 and all(
            len(q.choices.all()) >= 2 and any(c.is_correct for c in q.choices.all()) for q in questions
        )
        if not valid:
            missing_quiz.append(module)
    add(
        "quizzes",
        "Un quiz valide (2 questions minimum) à chaque module",
        modules and not missing_quiz,
        "il manque le quiz du " + ", ".join(f"module {m.order}" for m in missing_quiz) if missing_quiz else "",
    )
    add("tags", "Au moins 3 mots-clés (utilisés pour les embeddings)", course.tags.count() >= 3)
    return checks


def can_submit(course: Course) -> tuple[bool, str]:
    checks = {c["key"]: c for c in course_checklist(course)}
    if not checks["modules"]["ok"] or not checks["lessons"]["ok"]:
        return False, "Ajoute au moins 2 modules contenant chacun une leçon avant de soumettre le cours."
    return True, ""


def instructor_courses(user):
    """Cours visibles dans l'espace formateur : les siens, ou tous pour un administrateur."""
    qs = Course.objects.all()
    if user.role != "admin":
        qs = qs.filter(instructor=user)
    return qs


def completion_rate(course_ids) -> dict[int, float]:
    rows = (
        Enrollment.objects.filter(course_id__in=course_ids)
        .values("course_id")
        .annotate(total=Count("id"), done=Count("id", filter=Q(status=Enrollment.Status.COMPLETED)))
    )
    return {r["course_id"]: (r["done"] / r["total"] if r["total"] else 0.0) for r in rows}

