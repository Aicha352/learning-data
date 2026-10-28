from django.conf import settings
from django.db import models
from django.utils import timezone


class ModelVersion(models.Model):
    """Une version entraînée d'un modèle, avec ses métriques d'évaluation."""

    class Kind(models.TextChoices):
        POPULARITY = "popularity", "Popularité (référence)"
        COLLABORATIVE = "collaborative", "Filtrage collaboratif"
        CONTENT = "content", "Embeddings de contenu"
        HYBRID = "hybrid", "Modèle hybride"
        DROPOUT = "dropout", "Détection d'abandon"
        SEGMENTS = "segments", "Profils d'apprenants"

    kind = models.CharField(max_length=20, choices=Kind.choices, db_index=True)
    version = models.PositiveIntegerField(default=1)
    metrics = models.JSONField(default=dict)
    params = models.JSONField(default=dict)
    n_samples = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=False)
    trained_at = models.DateTimeField(default=timezone.now)
    training_run = models.ForeignKey("TrainingRun", null=True, blank=True, on_delete=models.SET_NULL, related_name="versions")

    class Meta:
        ordering = ["-trained_at"]

    def __str__(self):
        return f"{self.get_kind_display()} v{self.version}"


class TrainingRun(models.Model):
    """Une exécution du pipeline : collecte → nettoyage → entraînement → évaluation → déploiement."""

    class Status(models.TextChoices):
        RUNNING = "running", "En cours"
        SUCCESS = "success", "Réussi"
        FAILED = "failed", "Échec"

    status = models.CharField(max_length=20, choices=Status.choices, default=Status.RUNNING)
    triggered_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL)
    trigger = models.CharField(max_length=20, default="manual")  # manual | schedule | seed
    steps = models.JSONField(default=list)
    summary = models.JSONField(default=dict)
    error = models.TextField(blank=True)
    started_at = models.DateTimeField(default=timezone.now)
    finished_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-started_at"]

    @property
    def duration_seconds(self) -> float | None:
        if not self.finished_at:
            return None
        return round((self.finished_at - self.started_at).total_seconds(), 1)


class CourseEmbedding(models.Model):
    course = models.OneToOneField("courses.Course", on_delete=models.CASCADE, related_name="embedding")
    vector = models.JSONField(default=list)
    x = models.FloatField(default=0.5)  # projection 2D pour la carte des cours
    y = models.FloatField(default=0.5)
    updated_at = models.DateTimeField(auto_now=True)


class Recommendation(models.Model):
    """Recommandations pré-calculées pour un apprenant (servies par l'API)."""

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="recommendations")
    course = models.ForeignKey("courses.Course", on_delete=models.CASCADE, related_name="recommendations")
    score = models.FloatField()  # score hybride entre 0 et 1
    collaborative = models.FloatField(default=0)
    content = models.FloatField(default=0)
    profile = models.FloatField(default=0)
    reasons = models.JSONField(default=list)
    rank = models.PositiveSmallIntegerField(default=0)
    created_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["rank"]
        constraints = [models.UniqueConstraint(fields=["user", "course"], name="unique_recommendation")]


class RecommendationFeedback(models.Model):
    class Action(models.TextChoices):
        DISMISSED = "dismissed", "Pas intéressé"
        CLICKED = "clicked", "Cliqué"

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="recommendation_feedback")
    course = models.ForeignKey("courses.Course", on_delete=models.CASCADE, related_name="recommendation_feedback")
    action = models.CharField(max_length=20, choices=Action.choices)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["user", "course", "action"], name="unique_reco_feedback")]


class DropoutPrediction(models.Model):
    """Dernière prédiction du risque d'abandon pour une inscription en cours."""

    class Level(models.TextChoices):
        LOW = "low", "Faible"
        MEDIUM = "medium", "Moyen"
        HIGH = "high", "Élevé"

    enrollment = models.OneToOneField("courses.Enrollment", on_delete=models.CASCADE, related_name="risk")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="risk_predictions")
    course = models.ForeignKey("courses.Course", on_delete=models.CASCADE, related_name="risk_predictions")
    score = models.FloatField(db_index=True)
    previous_score = models.FloatField(null=True, blank=True)
    level = models.CharField(max_length=10, choices=Level.choices, db_index=True)
    contributions = models.JSONField(default=list)
    features = models.JSONField(default=dict)
    predicted_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ["-score"]


class LearnerSegment(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="segment")
    segment = models.CharField(max_length=40, db_index=True)
    features = models.JSONField(default=dict)
    updated_at = models.DateTimeField(auto_now=True)
