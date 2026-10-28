"""Tests des modèles : on génère un petit jeu de données simulé puis on entraîne."""
import pytest
from django.core.management import call_command

from apps.accounts.models import User
from apps.courses.models import Course, Enrollment
from apps.ml.models import DropoutPrediction, ModelVersion, Recommendation, TrainingRun

from .conftest import PASSWORD, client_for

pytestmark = pytest.mark.django_db


@pytest.fixture
def trained(db):
    call_command("seed_demo", learners=120, seed=7, verbosity=0)
    return User.objects.get(email="aminata@learningdata.app")


def login(email):
    user = User.objects.get(email=email)
    user.set_password(PASSWORD)
    user.save()
    return client_for(user)


def test_pipeline_produces_active_models(trained):
    kinds = set(ModelVersion.objects.filter(is_active=True).values_list("kind", flat=True))
    assert {"popularity", "collaborative", "content", "hybrid", "dropout", "segments"} <= kinds
    run = TrainingRun.objects.first()
    assert run.status == TrainingRun.Status.SUCCESS
    assert [s["status"] for s in run.steps] == ["success"] * 5


def test_hybrid_beats_popularity_baseline(trained):
    metrics = {v.kind: v.metrics for v in ModelVersion.objects.filter(is_active=True)}
    assert metrics["hybrid"]["ndcg_at_k"] >= metrics["popularity"]["ndcg_at_k"]
    assert 0 <= metrics["hybrid"]["precision_at_k"] <= 1
    weights = ModelVersion.objects.get(kind="hybrid", is_active=True).params["weights"]
    assert sum(weights.values()) == pytest.approx(1.0, abs=1e-6)


def test_dropout_model_is_better_than_chance(trained):
    dropout = ModelVersion.objects.get(kind="dropout", is_active=True).metrics
    assert dropout["auc"] > 0.6
    predictions = DropoutPrediction.objects.all()
    assert predictions.exists()
    assert all(0 <= p.score <= 1 for p in predictions)


def test_recommendations_are_explained_and_exclude_enrolled(trained):
    client = login(trained.email)
    data = client.get("/api/recommendations/").json()
    items = data["results"] if isinstance(data, dict) else data
    assert items, "aucune recommandation"
    enrolled = set(Enrollment.objects.filter(user=trained).values_list("course_id", flat=True))
    for item in items:
        assert item["id"] not in enrolled
        assert item["recommendation"]["reasons"], "recommandation sans explication"
        assert 0 <= item["recommendation"]["score"] <= 1


def test_dismissed_course_is_not_recommended_again(trained):
    client = login(trained.email)
    data = client.get("/api/recommendations/").json()
    items = data["results"] if isinstance(data, dict) else data
    course_id = items[0]["id"]
    assert client.post(f"/api/recommendations/{course_id}/dismiss/").status_code == 200
    data = client.get("/api/recommendations/").json()
    items = data["results"] if isinstance(data, dict) else data
    assert course_id not in [i["id"] for i in items]


def test_cold_start_user_gets_recommendations_from_profile():
    call_command("seed_demo", learners=60, seed=3, verbosity=0)
    client = client_for()
    client.post(
        "/api/auth/register/",
        {"first_name": "Nouvelle", "last_name": "Venue", "email": "nouvelle@test.dev", "password": PASSWORD},
        content_type="application/json",
    )
    from apps.courses.models import Tag

    python = Tag.objects.filter(name__icontains="python").values_list("id", flat=True)[:2]
    client.patch("/api/auth/me/profile/", {"goal": "data_analyst", "level": "beginner", "weekly_hours": "1-2", "interest_ids": list(python)}, content_type="application/json")
    data = client.get("/api/recommendations/").json()
    items = data["results"] if isinstance(data, dict) else data
    assert len(items) >= 3
    published = set(Course.objects.filter(status=Course.Status.PUBLISHED).values_list("id", flat=True))
    assert {i["id"] for i in items} <= published


def test_admin_can_retrain(trained):
    admin = login("admin@learningdata.app")
    before = TrainingRun.objects.count()
    response = admin.post("/api/ml/train/")
    assert response.status_code == 202, response.content
    run = TrainingRun.objects.get(pk=response.json()["id"])
    assert run.status == TrainingRun.Status.SUCCESS and TrainingRun.objects.count() == before + 1
    instructor = login("issa.traore@learningdata.app")
    assert instructor.post("/api/ml/train/").status_code == 403
    assert Recommendation.objects.exists()
