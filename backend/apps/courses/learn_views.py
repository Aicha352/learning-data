"""Espace d'apprentissage de l'apprenant : mes cours, leçons, notes, quiz, résultats, certificats."""
import hashlib

from django.db import transaction
from django.db.models import Max
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.permissions import IsLearner
from apps.tracking.services import record_event

from .models import (
    AttemptAnswer,
    Course,
    Enrollment,
    Lesson,
    LessonNote,
    LessonProgress,
    Quiz,
    QuizAttempt,
)
from .serializers import EnrollmentSerializer, NoteSerializer, QuizSubmitSerializer
from .services import (
    completed_lesson_ids,
    next_step,
    ordered_lessons,
    passed_quiz_ids,
    recompute_progress,
    with_stats,
)


def get_enrollment_or_403(user, course) -> Enrollment | None:
    return Enrollment.objects.filter(user=user, course=course).first()


NOT_ENROLLED = {"detail": "Tu dois être inscrit à ce cours pour accéder à ce contenu.", "errors": {}}


class MyEnrollmentsView(APIView):
    permission_classes = [IsLearner]

    def get(self, request):
        enrollments = (
            Enrollment.objects.filter(user=request.user)
            .select_related("course__category", "course__instructor", "risk")
            .prefetch_related("course__tags")
            .order_by("-last_activity_at", "-enrolled_at")
        )
        status_filter = request.query_params.get("status")
        if status_filter in {Enrollment.Status.ACTIVE, Enrollment.Status.COMPLETED}:
            enrollments = enrollments.filter(status=status_filter)
        course_ids = [e.course_id for e in enrollments]
        stats = {
            c.id: c
            for c in with_stats(Course.objects.filter(id__in=course_ids))
            .select_related("category", "instructor")
            .prefetch_related("tags")
        }
        results = []
        for enrollment in enrollments:
            course = stats.get(enrollment.course_id, enrollment.course)
            enrollment.course = course
            data = EnrollmentSerializer(enrollment, context={"request": request}).data
            data["next"] = next_step(request.user, course) if enrollment.status == Enrollment.Status.ACTIVE else None
            risk = getattr(enrollment, "risk", None)
            data["risk_level"] = risk.level if risk else None
            results.append(data)
        return Response(results)


class LearnCourseView(APIView):
    """Plan du cours avec l'état de chaque leçon et de chaque quiz."""

    permission_classes = [IsLearner]

    def get(self, request, slug):
        course = get_object_or_404(Course, slug=slug)
        enrollment = get_enrollment_or_403(request.user, course)
        if not enrollment:
            return Response(NOT_ENROLLED, status=status.HTTP_403_FORBIDDEN)
        done = completed_lesson_ids(request.user, course)
        passed = passed_quiz_ids(request.user, course)
        best_scores = dict(
            QuizAttempt.objects.filter(user=request.user, quiz__module__course=course)
            .values("quiz_id")
            .annotate(best=Max("score"))
            .values_list("quiz_id", "best")
        )
        modules = []
        for module in course.modules.prefetch_related("lessons").select_related("quiz"):
            quiz = getattr(module, "quiz", None)
            lessons = [
                {"id": l.id, "title": l.title, "duration_minutes": l.duration_minutes, "completed": l.id in done}
                for l in module.lessons.all()
            ]
            modules.append(
                {
                    "id": module.id,
                    "title": module.title,
                    "order": module.order,
                    "lessons": lessons,
                    "completed_lessons": sum(1 for l in lessons if l["completed"]),
                    "quiz": {
                        "id": quiz.id,
                        "title": quiz.title,
                        "passed": quiz.id in passed,
                        "best_score": best_scores.get(quiz.id),
                        "question_count": quiz.questions.count(),
                    }
                    if quiz
                    else None,
                }
            )
        return Response(
            {
                "course": {
                    "id": course.id,
                    "slug": course.slug,
                    "title": course.title,
                    "cover_color": course.cover_color,
                    "instructor": course.instructor.full_name,
                },
                "enrollment": {
                    "id": enrollment.id,
                    "status": enrollment.status,
                    "progress": enrollment.progress,
                    "completed_at": enrollment.completed_at,
                },
                "modules": modules,
                "next": next_step(request.user, course),
            }
        )


class LessonDetailView(APIView):
    permission_classes = [IsLearner]

    def get(self, request, pk):
        lesson = get_object_or_404(Lesson.objects.select_related("module__course"), pk=pk)
        course = lesson.module.course
        enrollment = get_enrollment_or_403(request.user, course)
        if not enrollment:
            return Response(NOT_ENROLLED, status=status.HTTP_403_FORBIDDEN)

        lessons = ordered_lessons(course)
        index = next(i for i, l in enumerate(lessons) if l.id == lesson.id)
        done = completed_lesson_ids(request.user, course)
        progress = LessonProgress.objects.filter(user=request.user, lesson=lesson).first()
        note = LessonNote.objects.filter(user=request.user, lesson=lesson).first()
        quiz = getattr(lesson.module, "quiz", None)
        module_lessons = [l for l in lessons if l.module_id == lesson.module_id]

        record_event(request.user, "lesson_open", course=course, lesson=lesson)
        return Response(
            {
                "id": lesson.id,
                "title": lesson.title,
                "content": lesson.content,
                "video_url": lesson.video_url,
                "duration_minutes": lesson.duration_minutes,
                "completed": lesson.id in done,
                "last_position_seconds": progress.last_position_seconds if progress else 0,
                "note": note.content if note else "",
                "course": {"id": course.id, "slug": course.slug, "title": course.title},
                "module": {
                    "id": lesson.module.id,
                    "title": lesson.module.title,
                    "order": lesson.module.order,
                    "lessons": [
                        {"id": l.id, "title": l.title, "duration_minutes": l.duration_minutes, "completed": l.id in done}
                        for l in module_lessons
                    ],
                    "completed_count": sum(1 for l in module_lessons if l.id in done),
                },
                "quiz": {"id": quiz.id, "title": quiz.title, "passed": quiz.id in passed_quiz_ids(request.user, course)}
                if quiz
                else None,
                "previous_lesson": lessons[index - 1].id if index > 0 else None,
                "next_lesson": lessons[index + 1].id if index + 1 < len(lessons) else None,
                "position": index + 1,
                "total_lessons": len(lessons),
                "progress": enrollment.progress,
            }
        )


class LessonCompleteView(APIView):
    permission_classes = [IsLearner]

    def post(self, request, pk):
        lesson = get_object_or_404(Lesson.objects.select_related("module__course"), pk=pk)
        course = lesson.module.course
        enrollment = get_enrollment_or_403(request.user, course)
        if not enrollment:
            return Response(NOT_ENROLLED, status=status.HTTP_403_FORBIDDEN)
        with transaction.atomic():
            progress, _ = LessonProgress.objects.get_or_create(user=request.user, lesson=lesson)
            if not progress.completed:
                progress.completed = True
                progress.completed_at = timezone.now()
                progress.save(update_fields=["completed", "completed_at", "updated_at"])
                record_event(request.user, "lesson_complete", course=course, lesson=lesson)
            enrollment = recompute_progress(enrollment)
        return Response(
            {
                "completed": True,
                "progress": enrollment.progress,
                "course_completed": enrollment.status == Enrollment.Status.COMPLETED,
                "next": next_step(request.user, course),
            }
        )


class LessonNoteView(APIView):
    permission_classes = [IsLearner]

    def put(self, request, pk):
        lesson = get_object_or_404(Lesson.objects.select_related("module__course"), pk=pk)
        if not get_enrollment_or_403(request.user, lesson.module.course):
            return Response(NOT_ENROLLED, status=status.HTTP_403_FORBIDDEN)
        serializer = NoteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        note, _ = LessonNote.objects.update_or_create(
            user=request.user, lesson=lesson, defaults={"content": serializer.validated_data["content"]}
        )
        return Response({"content": note.content, "updated_at": note.updated_at})


class QuizDetailView(APIView):
    permission_classes = [IsLearner]

    def get(self, request, pk):
        quiz = get_object_or_404(Quiz.objects.select_related("module__course"), pk=pk)
        course = quiz.module.course
        if not get_enrollment_or_403(request.user, course):
            return Response(NOT_ENROLLED, status=status.HTTP_403_FORBIDDEN)
        attempts = list(QuizAttempt.objects.filter(user=request.user, quiz=quiz).order_by("-submitted_at")[:5])
        record_event(request.user, "quiz_start", course=course, metadata={"quiz": quiz.id})
        return Response(
            {
                "id": quiz.id,
                "title": quiz.title,
                "pass_score": quiz.pass_score,
                "course": {"id": course.id, "slug": course.slug, "title": course.title},
                "module": {"id": quiz.module.id, "title": quiz.module.title, "order": quiz.module.order},
                "questions": [
                    {
                        "id": q.id,
                        "text": q.text,
                        "code": q.code,
                        "hint": q.hint,
                        "choices": [{"id": c.id, "text": c.text} for c in q.choices.all()],
                    }
                    for q in quiz.questions.prefetch_related("choices")
                ],
                "attempts": [
                    {"id": a.id, "score": a.score, "passed": a.passed, "submitted_at": a.submitted_at} for a in attempts
                ],
            }
        )


class QuizSubmitView(APIView):
    permission_classes = [IsLearner]

    def post(self, request, pk):
        quiz = get_object_or_404(Quiz.objects.select_related("module__course"), pk=pk)
        course = quiz.module.course
        enrollment = get_enrollment_or_403(request.user, course)
        if not enrollment:
            return Response(NOT_ENROLLED, status=status.HTTP_403_FORBIDDEN)
        serializer = QuizSubmitSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        questions = list(quiz.questions.prefetch_related("choices"))
        if not questions:
            return Response({"detail": "Ce quiz ne contient aucune question.", "errors": {}}, status=400)
        chosen = {a["question"]: a.get("choice") for a in data["answers"]}

        with transaction.atomic():
            attempt = QuizAttempt.objects.create(
                user=request.user,
                quiz=quiz,
                total=len(questions),
                hints_used=data["hints_used"],
                duration_seconds=data["duration_seconds"],
            )
            answers, correct = [], 0
            for question in questions:
                choice_map = {c.id: c for c in question.choices.all()}
                choice = choice_map.get(chosen.get(question.id))
                is_correct = bool(choice and choice.is_correct)
                correct += int(is_correct)
                answers.append(AttemptAnswer(attempt=attempt, question=question, choice=choice, is_correct=is_correct))
            AttemptAnswer.objects.bulk_create(answers)
            attempt.correct_count = correct
            attempt.score = round(100 * correct / len(questions), 1)
            attempt.passed = attempt.score >= quiz.pass_score
            attempt.save(update_fields=["correct_count", "score", "passed"])
            record_event(request.user, "quiz_submit", course=course, value=attempt.score, metadata={"quiz": quiz.id})
            recompute_progress(enrollment)
        return Response({"attempt_id": attempt.id, "score": attempt.score, "passed": attempt.passed}, status=201)


class AttemptResultView(APIView):
    permission_classes = [IsLearner]

    def get(self, request, pk):
        attempt = get_object_or_404(
            QuizAttempt.objects.select_related("quiz__module__course"), pk=pk, user=request.user
        )
        quiz = attempt.quiz
        course = quiz.module.course
        answers = {a.question_id: a for a in attempt.answers.select_related("choice")}
        details, strengths, weaknesses, remediation = [], {}, {}, {}
        for question in quiz.questions.prefetch_related("choices").select_related("lesson"):
            answer = answers.get(question.id)
            ok = bool(answer and answer.is_correct)
            topic = question.topic or "Notions du module"
            bucket = strengths if ok else weaknesses
            bucket[topic] = bucket.get(topic, 0) + 1
            if not ok and question.lesson:
                remediation[question.lesson.id] = question.lesson.title
            details.append(
                {
                    "id": question.id,
                    "text": question.text,
                    "code": question.code,
                    "topic": topic,
                    "is_correct": ok,
                    "explanation": question.explanation,
                    "choices": [
                        {
                            "id": c.id,
                            "text": c.text,
                            "is_correct": c.is_correct,
                            "chosen": bool(answer and answer.choice_id == c.id),
                        }
                        for c in question.choices.all()
                    ],
                    "lesson": {"id": question.lesson.id, "title": question.lesson.title} if question.lesson else None,
                }
            )
        for topic in list(strengths):
            if topic in weaknesses:
                strengths.pop(topic)

        enrollment = Enrollment.objects.filter(user=request.user, course=course).first()
        risk = getattr(enrollment, "risk", None) if enrollment else None
        history = list(
            QuizAttempt.objects.filter(user=request.user, quiz=quiz).order_by("submitted_at").values("id", "score", "submitted_at")
        )
        return Response(
            {
                "id": attempt.id,
                "score": attempt.score,
                "passed": attempt.passed,
                "correct_count": attempt.correct_count,
                "total": attempt.total,
                "pass_score": quiz.pass_score,
                "duration_seconds": attempt.duration_seconds,
                "hints_used": attempt.hints_used,
                "submitted_at": attempt.submitted_at,
                "quiz": {"id": quiz.id, "title": quiz.title},
                "module": {"id": quiz.module.id, "title": quiz.module.title, "order": quiz.module.order},
                "course": {"id": course.id, "slug": course.slug, "title": course.title},
                "questions": details,
                "strengths": sorted(strengths),
                "weaknesses": [{"topic": t, "errors": n} for t, n in sorted(weaknesses.items(), key=lambda x: -x[1])],
                "remediation": [{"id": i, "title": t} for i, t in remediation.items()],
                "next": next_step(request.user, course),
                "course_completed": bool(enrollment and enrollment.status == Enrollment.Status.COMPLETED),
                "risk": {"level": risk.level, "score": risk.score} if risk else None,
                "history": history,
            }
        )


class CertificateView(APIView):
    permission_classes = [IsLearner]

    def get(self, request, slug):
        course = get_object_or_404(with_stats(Course.objects.select_related("instructor")), slug=slug)
        enrollment = Enrollment.objects.filter(
            user=request.user, course=course, status=Enrollment.Status.COMPLETED
        ).first()
        if not enrollment:
            return Response(
                {"detail": "Le certificat sera disponible quand tu auras terminé le cours.", "errors": {}},
                status=status.HTTP_404_NOT_FOUND,
            )
        code = hashlib.sha1(f"{enrollment.id}-{request.user.email}-{course.slug}".encode()).hexdigest()[:10].upper()
        return Response(
            {
                "learner": request.user.full_name,
                "course": course.title,
                "course_slug": course.slug,
                "instructor": course.instructor.full_name,
                "completed_at": enrollment.completed_at,
                "duration_minutes": course.total_minutes,
                "certificate_id": f"LD-{code}",
            }
        )
