import pytest
from django.core import mail

from apps.accounts.models import User
from apps.administration.models import ActivityLog
from apps.courses.models import Course

from .conftest import build_course, client_for, make_user

pytestmark = pytest.mark.django_db


def _quiz_payload(lesson_id):
    return {
        "title": "Quiz",
        "pass_score": 70,
        "questions": [
            {"text": f"Question {i} ?", "topic": "Notion", "lesson": lesson_id, "choices": [{"text": "Oui", "is_correct": True}, {"text": "Non", "is_correct": False}]}
            for i in (1, 2)
        ],
    }


def test_full_course_authoring_and_review(instructor, admin_user, category):
    client = client_for(instructor)
    created = client.post(
        "/api/instructor/courses/",
        {
            "title": "Mon nouveau cours", "subtitle": "", "category": category.id, "level": "beginner",
            "description": "Une description détaillée du cours qui dépasse largement les quatre-vingts caractères demandés.",
            "tags": ["sql", "données", "requêtes"], "learning_outcomes": ["Écrire une requête", "Filtrer des lignes"],
            "prerequisites": "", "cover_color": "#EAF0FF",
        },
        content_type="application/json",
    )
    assert created.status_code == 201, created.content
    course_id = created.json()["id"]

    # Soumission refusée tant que le programme est vide
    assert client.post(f"/api/instructor/courses/{course_id}/submit/").status_code == 400

    for m in (1, 2):
        module = client.post("/api/instructor/modules/", {"course": course_id, "title": f"Module {m}"}, content_type="application/json")
        assert module.status_code == 201, module.content
        module_id = module.json()["id"]
        lesson = client.post("/api/instructor/lessons/", {"module": module_id, "title": "Leçon", "content": "Texte", "duration_minutes": 8}, content_type="application/json")
        assert lesson.status_code == 201, lesson.content
        quiz = client.put(f"/api/instructor/modules/{module_id}/quiz/", _quiz_payload(lesson.json()["id"]), content_type="application/json")
        assert quiz.status_code == 200, quiz.content

    detail = client.get(f"/api/instructor/courses/{course_id}/").json()
    assert all(item["ok"] for item in detail["checklist"]), detail["checklist"]
    assert client.post(f"/api/instructor/courses/{course_id}/submit/").status_code == 200
    assert Course.objects.get(pk=course_id).status == Course.Status.PENDING

    admin = client_for(admin_user)
    assert admin.post(f"/api/admin/course-reviews/{course_id}/", {"decision": "reject"}, content_type="application/json").status_code == 400
    approved = admin.post(f"/api/admin/course-reviews/{course_id}/", {"decision": "approve", "comment": ""}, content_type="application/json")
    assert approved.status_code == 200, approved.content
    assert Course.objects.get(pk=course_id).status == Course.Status.PUBLISHED
    assert instructor.notifications.filter(title__icontains="publié").exists()
    assert client_for().get("/api/courses/").json()["count"] == 1


def test_quiz_validation_requires_a_correct_answer(instructor, course):
    module = course.modules.first()
    payload = _quiz_payload(None)
    payload["questions"][0]["choices"] = [{"text": "A", "is_correct": False}, {"text": "B", "is_correct": False}]
    response = client_for(instructor).put(f"/api/instructor/modules/{module.id}/quiz/", payload, content_type="application/json")
    assert response.status_code == 400


def test_instructor_cannot_edit_someone_else_course(course, category):
    other = make_user("autre@test.dev", role=User.Role.INSTRUCTOR)
    client = client_for(other)
    assert client.get(f"/api/instructor/courses/{course.id}/").status_code == 404
    module = course.modules.first()
    response = client.post("/api/instructor/lessons/", {"module": module.id, "title": "Intrus"}, content_type="application/json")
    assert response.status_code in (403, 404)


def test_instructor_views(instructor, course, learner):
    learner_client = client_for(learner)
    learner_client.post(f"/api/courses/{course.slug}/enroll/")
    client = client_for(instructor)
    for url in ["/api/instructor/overview/", "/api/instructor/at-risk/", "/api/instructor/analytics/", f"/api/instructor/learners/{learner.id}/", "/api/ml/overview/"]:
        assert client.get(url).status_code == 200, url
    csv = client.get("/api/instructor/at-risk/?export=csv")
    assert csv.status_code == 200 and csv["Content-Type"].startswith("text/csv")
    intervention = client.post(
        f"/api/instructor/learners/{learner.id}/interventions/",
        {"kind": "message", "course": course.id, "message": "Courage, tu y es presque !"},
        content_type="application/json",
    )
    assert intervention.status_code == 201, intervention.content
    assert learner.notifications.exists()


def test_admin_user_management(admin_user, learner):
    client = client_for(admin_user)
    created = client.post("/api/admin/users/", {"first_name": "Nina", "last_name": "Ka", "email": "nina@test.dev", "role": "instructor"}, content_type="application/json")
    assert created.status_code == 201, created.content
    data = created.json()
    assert data["temporary_password"] and len(mail.outbox) == 1
    user = User.objects.get(email="nina@test.dev")
    assert user.check_password(data["temporary_password"])

    assert client.post(f"/api/admin/users/{user.id}/suspend/").json()["status"] == "suspended"
    assert client.post(f"/api/admin/users/{user.id}/activate/").json()["status"] == "active"
    reset = client.post(f"/api/admin/users/{user.id}/reset-password/").json()
    user.refresh_from_db()
    assert user.check_password(reset["temporary_password"])
    assert client.patch(f"/api/admin/users/{user.id}/", {"role": "learner"}, content_type="application/json").json()["role"] == "learner"
    assert client.get("/api/admin/users/?search=nina").json()["count"] == 1
    assert client.get("/api/admin/users/?role=admin").json()["count"] == 1

    # L'admin ne peut ni se suspendre ni se retirer son rôle
    assert client.post(f"/api/admin/users/{admin_user.id}/suspend/").status_code == 400
    assert client.patch(f"/api/admin/users/{admin_user.id}/", {"role": "learner"}, content_type="application/json").status_code == 400
    assert client.delete(f"/api/admin/users/{user.id}/").status_code == 204
    assert ActivityLog.objects.filter(description__icontains="Compte supprimé").exists()


def test_admin_settings_validation(admin_user):
    client = client_for(admin_user)
    assert client.get("/api/admin/settings/").status_code == 200
    ok = client.put("/api/admin/settings/", {"recommendations_count": 12}, content_type="application/json")
    assert ok.status_code == 200 and ok.json()["recommendations_count"] == 12
    assert client.put("/api/admin/settings/", {"recommendations_count": 99}, content_type="application/json").status_code == 400
    bad = client.put("/api/admin/settings/", {"risk_threshold": 0.6, "medium_risk_threshold": 0.65}, content_type="application/json")
    assert bad.status_code == 400 and "medium_risk_threshold" in bad.json()["errors"]
    log = client.get("/api/admin/activity/?period=all").json()
    assert any("Paramètres modifiés" in entry["description"] for entry in log["results"])


def test_admin_pages(admin_user, course):
    client = client_for(admin_user)
    for url in ["/api/admin/dashboard/", "/api/admin/roles/", "/api/admin/course-reviews/?status=all", "/api/admin/activity/?export=csv"]:
        assert client.get(url).status_code == 200, url
