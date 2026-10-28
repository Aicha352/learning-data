import pytest

from apps.accounts.models import User

from .conftest import PASSWORD, client_for, make_user

pytestmark = pytest.mark.django_db


def test_register_learner_sets_cookies_and_profile():
    client = client_for()
    response = client.post(
        "/api/auth/register/",
        {"first_name": "Awa", "last_name": "Diallo", "email": "AWA@test.dev", "password": PASSWORD, "role": "learner"},
        content_type="application/json",
    )
    assert response.status_code == 201, response.content
    assert "ld_access" in response.cookies and "ld_refresh" in response.cookies
    assert response.cookies["ld_access"]["httponly"]
    user = User.objects.get(email="awa@test.dev")
    assert user.profile is not None
    me = client.get("/api/auth/me/").json()
    assert me["email"] == "awa@test.dev" and me["onboarding_completed"] is False


def test_register_rejects_weak_password_with_field_error():
    response = client_for().post(
        "/api/auth/register/",
        {"first_name": "A", "last_name": "B", "email": "a@test.dev", "password": "123"},
        content_type="application/json",
    )
    assert response.status_code == 400
    assert "password" in response.json()["errors"]


def test_instructor_registration_is_pending_and_cannot_login():
    client = client_for()
    response = client.post(
        "/api/auth/register/",
        {"first_name": "K", "last_name": "B", "email": "k@test.dev", "password": PASSWORD, "role": "instructor"},
        content_type="application/json",
    )
    assert response.status_code == 201
    assert User.objects.get(email="k@test.dev").status == User.Status.PENDING
    login = client_for().post("/api/auth/login/", {"email": "k@test.dev", "password": PASSWORD}, content_type="application/json")
    assert login.status_code in (400, 401, 403)


def test_login_wrong_password_and_suspended(learner):
    bad = client_for().post("/api/auth/login/", {"email": learner.email, "password": "faux"}, content_type="application/json")
    assert bad.status_code in (400, 401)
    learner.status = User.Status.SUSPENDED
    learner.save()
    blocked = client_for().post("/api/auth/login/", {"email": learner.email, "password": PASSWORD}, content_type="application/json")
    assert blocked.status_code in (400, 401, 403)


def test_refresh_and_logout(learner):
    client = client_for(learner)
    assert client.post("/api/auth/refresh/").status_code == 200
    assert client.post("/api/auth/logout/").status_code in (200, 204)
    assert client.get("/api/auth/me/").status_code == 401


def test_change_password(learner):
    client = client_for(learner)
    response = client.post(
        "/api/auth/me/password/",
        {"current_password": PASSWORD, "new_password": "NouveauMotDePasse456!"},
        content_type="application/json",
    )
    assert response.status_code == 200, response.content
    learner.refresh_from_db()
    assert learner.check_password("NouveauMotDePasse456!")


def test_role_permissions(learner, instructor):
    assert client_for(learner).get("/api/instructor/overview/").status_code == 403
    assert client_for(learner).get("/api/admin/dashboard/").status_code == 403
    assert client_for(instructor).get("/api/admin/dashboard/").status_code == 403
    assert client_for().get("/api/me/dashboard/").status_code == 401


def test_profile_update(learner):
    from apps.courses.models import Tag

    tag = Tag.objects.create(name="python", slug="python")
    client = client_for(learner)
    response = client.patch(
        "/api/auth/me/profile/",
        {"goal": "data_analyst", "level": "beginner", "weekly_hours": "1-2", "interest_ids": [tag.id]},
        content_type="application/json",
    )
    assert response.status_code == 200, response.content
    learner.profile.refresh_from_db()
    assert learner.profile.onboarding_completed
    assert list(learner.profile.interests.all()) == [tag]


def test_new_user_never_sees_admin_with_same_email_case(learner):
    response = client_for().post(
        "/api/auth/register/",
        {"first_name": "X", "last_name": "Y", "email": learner.email.upper(), "password": PASSWORD},
        content_type="application/json",
    )
    assert response.status_code == 400
