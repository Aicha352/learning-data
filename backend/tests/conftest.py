"""Fixtures partagées par les tests du backend."""
import pytest
from django.test import Client
from django.utils import timezone
from django.utils.text import slugify

from apps.accounts.models import User
from apps.courses.models import Category, Choice, Course, Lesson, Module, Question, Quiz, Tag

PASSWORD = "MotDePasse123!"


@pytest.fixture(autouse=True)
def _ml_settings(settings, tmp_path):
    settings.ML_TRAIN_IN_BACKGROUND = False
    settings.ML_ARTIFACTS_DIR = tmp_path / "ml"
    settings.EMAIL_BACKEND = "django.core.mail.backends.locmem.EmailBackend"
    settings.REST_FRAMEWORK = {**settings.REST_FRAMEWORK, "DEFAULT_THROTTLE_CLASSES": [], "DEFAULT_THROTTLE_RATES": {"auth": None, "events": None}}


def make_user(email, role=User.Role.LEARNER, status=User.Status.ACTIVE, **extra):
    return User.objects.create_user(
        email=email, password=PASSWORD, first_name=extra.pop("first_name", "Test"),
        last_name=extra.pop("last_name", role.capitalize()), role=role, status=status, **extra,
    )


@pytest.fixture
def learner(db):
    return make_user("apprenant@test.dev")


@pytest.fixture
def instructor(db):
    return make_user("formateur@test.dev", role=User.Role.INSTRUCTOR)


@pytest.fixture
def admin_user(db):
    return make_user("admin@test.dev", role=User.Role.ADMIN, is_staff=True)


def client_for(user=None) -> Client:
    client = Client(HTTP_HOST="localhost")
    if user is not None:
        response = client.post("/api/auth/login/", {"email": user.email, "password": PASSWORD}, content_type="application/json")
        assert response.status_code == 200, response.content
    return client


@pytest.fixture
def category(db):
    return Category.objects.create(name="Data Science", slug="data-science", color="#2D5BE3")


def build_course(instructor, category, title="Pandas pour débuter", status=Course.Status.PUBLISHED, modules=2):
    course = Course.objects.create(
        title=title, slug=slugify(title), subtitle="Sous-titre", category=category,
        description="Une description complète du cours, assez longue pour passer toutes les vérifications automatiques.",
        instructor=instructor, learning_outcomes=["Objectif A", "Objectif B"], status=status,
        published_at=timezone.now() if status == Course.Status.PUBLISHED else None,
    )
    for name in ("pandas", "python", "données"):
        tag, _ = Tag.objects.get_or_create(name=name, defaults={"slug": name})
        course.tags.add(tag)
    for m in range(1, modules + 1):
        module = Module.objects.create(course=course, title=f"Module {m}", order=m)
        lessons = [Lesson.objects.create(module=module, title=f"Leçon {m}.{i}", order=i, content="Contenu de la leçon.", duration_minutes=10) for i in (1, 2)]
        quiz = Quiz.objects.create(module=module, title=f"Quiz {m}", pass_score=70)
        for q in (1, 2):
            question = Question.objects.create(quiz=quiz, text=f"Question {q} ?", order=q, lesson=lessons[0], topic="Notion")
            Choice.objects.create(question=question, text="Bonne réponse", is_correct=True, order=1)
            Choice.objects.create(question=question, text="Mauvaise réponse", is_correct=False, order=2)
    return course


@pytest.fixture
def course(instructor, category):
    return build_course(instructor, category)
