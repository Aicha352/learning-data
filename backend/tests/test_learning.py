import pytest

from apps.courses.models import Course, Enrollment, LessonProgress, Question
from apps.tracking.models import LearningEvent

from .conftest import build_course, client_for

pytestmark = pytest.mark.django_db


def test_catalog_lists_only_published(course, instructor, category):
    build_course(instructor, category, title="Brouillon caché", status=Course.Status.DRAFT)
    data = client_for().get("/api/courses/").json()
    titles = [c["title"] for c in data["results"]]
    assert course.title in titles and "Brouillon caché" not in titles
    assert data["count"] == 1 and data["results"][0]["lesson_count"] == 4


def test_catalog_search_and_filters(course):
    client = client_for()
    assert client.get("/api/courses/?q=pandas").json()["count"] == 1
    assert client.get("/api/courses/?q=introuvable").json()["count"] == 0
    assert client.get("/api/courses/?level=advanced").json()["count"] == 0
    assert client.get(f"/api/courses/?category={course.category.slug}").json()["count"] == 1


def test_draft_course_detail_is_hidden(instructor, category):
    draft = build_course(instructor, category, title="Secret", status=Course.Status.DRAFT)
    assert client_for().get(f"/api/courses/{draft.slug}/").status_code == 404


def test_enroll_is_idempotent(learner, course):
    client = client_for(learner)
    first = client.post(f"/api/courses/{course.slug}/enroll/")
    second = client.post(f"/api/courses/{course.slug}/enroll/")
    assert first.status_code == 201 and second.status_code == 200
    assert Enrollment.objects.filter(user=learner, course=course).count() == 1


def test_lesson_requires_enrollment(learner, course):
    lesson = course.modules.first().lessons.first()
    assert client_for(learner).get(f"/api/learn/lessons/{lesson.id}/").status_code == 403


def test_completing_lessons_and_quizzes_completes_course(learner, course):
    client = client_for(learner)
    client.post(f"/api/courses/{course.slug}/enroll/")
    enrollment = Enrollment.objects.get(user=learner, course=course)
    for module in course.modules.all():
        for lesson in module.lessons.all():
            assert client.post(f"/api/learn/lessons/{lesson.id}/complete/").status_code == 200
        quiz = module.quiz
        answers = [{"question": q.id, "choice": q.choices.get(is_correct=True).id} for q in quiz.questions.all()]
        response = client.post(
            f"/api/learn/quizzes/{quiz.id}/submit/",
            {"answers": answers, "hints_used": 0, "duration_seconds": 42},
            content_type="application/json",
        )
        assert response.status_code in (200, 201), response.content
        result = response.json()
        assert result["score"] == 100 and result["passed"] is True
    enrollment.refresh_from_db()
    assert enrollment.progress == pytest.approx(1.0)
    assert enrollment.status == Enrollment.Status.COMPLETED
    assert LessonProgress.objects.filter(user=learner, completed=True).count() == 4
    assert client.get(f"/api/learn/courses/{course.slug}/certificate/").status_code == 200


def test_quiz_wrong_answers_fail_and_point_to_lesson(learner, course):
    client = client_for(learner)
    client.post(f"/api/courses/{course.slug}/enroll/")
    quiz = course.modules.first().quiz
    answers = [{"question": q.id, "choice": q.choices.get(is_correct=False).id} for q in quiz.questions.all()]
    result = client.post(
        f"/api/learn/quizzes/{quiz.id}/submit/", {"answers": answers, "hints_used": 1, "duration_seconds": 30}, content_type="application/json"
    ).json()
    assert result["score"] == 0 and result["passed"] is False
    detail = client.get(f"/api/learn/attempts/{result['attempt_id']}/").json()
    assert detail["score"] == 0
    assert client.get(f"/api/learn/courses/{course.slug}/certificate/").status_code in (403, 404)


def test_review_requires_enrollment(learner, course):
    client = client_for(learner)
    payload = {"rating": 5, "comment": "Très clair"}
    assert client.post(f"/api/courses/{course.slug}/review/", payload, content_type="application/json").status_code == 403
    client.post(f"/api/courses/{course.slug}/enroll/")
    assert client.post(f"/api/courses/{course.slug}/review/", payload, content_type="application/json").status_code in (200, 201)


def test_event_ingestion(learner, course):
    client = client_for(learner)
    lesson = course.modules.first().lessons.first()
    # Événement sur une leçon d'un cours non suivi : ignoré.
    client.post("/api/events/", {"events": [{"event_type": "video_play", "lesson": lesson.id, "value": 0}]}, content_type="application/json")
    assert not LearningEvent.objects.filter(user=learner, event_type="video_play").exists()
    client.post(f"/api/courses/{course.slug}/enroll/")
    response = client.post(
        "/api/events/",
        {"events": [{"event_type": "video_play", "course": course.id, "lesson": lesson.id, "value": 0}, {"event_type": "video_pause", "course": course.id, "lesson": lesson.id, "value": 30}]},
        content_type="application/json",
    )
    assert response.status_code in (200, 201, 202), response.content
    assert LearningEvent.objects.filter(user=learner, event_type__in=["video_play", "video_pause"]).count() == 2
    bad = client.post("/api/events/", {"events": [{"event_type": "hack"}]}, content_type="application/json")
    assert bad.status_code == 400


def test_learner_dashboard_and_progress(learner, course):
    client = client_for(learner)
    client.post(f"/api/courses/{course.slug}/enroll/")
    assert client.get("/api/me/dashboard/").status_code == 200
    assert client.get("/api/me/progress/").status_code == 200
