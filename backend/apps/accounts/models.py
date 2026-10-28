from django.contrib.auth.base_user import BaseUserManager
from django.contrib.auth.models import AbstractUser
from django.db import models

from apps.core.choices import Level
from apps.core.utils import avatar_color


class UserManager(BaseUserManager):
    use_in_migrations = True

    def _create_user(self, email, password, **extra_fields):
        if not email:
            raise ValueError("L'adresse e-mail est obligatoire.")
        email = self.normalize_email(email).lower()
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_user(self, email, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", False)
        extra_fields.setdefault("is_superuser", False)
        return self._create_user(email, password, **extra_fields)

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        extra_fields.setdefault("role", User.Role.ADMIN)
        extra_fields.setdefault("status", User.Status.ACTIVE)
        return self._create_user(email, password, **extra_fields)


class User(AbstractUser):
    """Utilisateur de la plateforme. L'identifiant de connexion est l'e-mail."""

    class Role(models.TextChoices):
        LEARNER = "learner", "Apprenant"
        INSTRUCTOR = "instructor", "Formateur"
        ADMIN = "admin", "Administrateur"

    class Status(models.TextChoices):
        ACTIVE = "active", "Actif"
        PENDING = "pending", "En attente"
        SUSPENDED = "suspended", "Suspendu"

    username = None
    email = models.EmailField("adresse e-mail", unique=True)
    role = models.CharField("rôle", max_length=20, choices=Role.choices, default=Role.LEARNER, db_index=True)
    status = models.CharField("statut", max_length=20, choices=Status.choices, default=Status.ACTIVE, db_index=True)
    headline = models.CharField("titre / métier", max_length=120, blank=True)

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["first_name", "last_name"]

    objects = UserManager()

    class Meta:
        verbose_name = "utilisateur"
        ordering = ["-date_joined"]

    def __str__(self):
        return f"{self.full_name} <{self.email}>"

    @property
    def full_name(self) -> str:
        return f"{self.first_name} {self.last_name}".strip() or self.email

    @property
    def initials(self) -> str:
        letters = (self.first_name[:1] + self.last_name[:1]).upper()
        return letters or self.email[:2].upper()

    @property
    def avatar_color(self) -> str:
        return avatar_color(self.email)

    @property
    def is_learner(self) -> bool:
        return self.role == self.Role.LEARNER

    @property
    def is_instructor(self) -> bool:
        return self.role == self.Role.INSTRUCTOR

    @property
    def is_platform_admin(self) -> bool:
        return self.role == self.Role.ADMIN


class LearnerProfile(models.Model):
    """Réponses au questionnaire d'accueil : elles servent au démarrage à froid."""

    class Goal(models.TextChoices):
        DATA_ANALYST = "data_analyst", "Devenir data analyst"
        DEVELOPER = "developer", "Apprendre à programmer"
        AI = "ai", "Me lancer dans l'IA"
        CAREER = "career", "Évoluer dans mon travail"

    class WeeklyHours(models.TextChoices):
        H1_2 = "1-2", "1 à 2 h"
        H3_5 = "3-5", "3 à 5 h"
        H6_10 = "6-10", "6 à 10 h"
        H10_PLUS = "10+", "Plus de 10 h"

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="profile")
    goal = models.CharField("objectif", max_length=30, choices=Goal.choices, blank=True)
    level = models.CharField("niveau", max_length=20, choices=Level.choices, default=Level.BEGINNER)
    weekly_hours = models.CharField("temps disponible", max_length=10, choices=WeeklyHours.choices, blank=True)
    interests = models.ManyToManyField("courses.Tag", blank=True, related_name="interested_profiles")
    onboarding_completed = models.BooleanField(default=False)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "profil apprenant"

    def __str__(self):
        return f"Profil de {self.user.full_name}"
