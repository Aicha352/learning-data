from django.conf import settings
from django.db import models


class PlatformSettings(models.Model):
    """Paramètres globaux de la plateforme (une seule ligne en base)."""

    class Recommender(models.TextChoices):
        HYBRID = "hybrid", "Hybride"
        COLLABORATIVE = "collaborative", "Filtrage collaboratif"
        CONTENT = "content", "Embeddings de contenu"
        POPULARITY = "popularity", "Popularité"

    platform_name = models.CharField("nom de la plateforme", max_length=80, default="Learning Data")
    contact_email = models.EmailField("e-mail de contact", default="contact@learningdata.app")
    default_language = models.CharField("langue par défaut", max_length=20, default="Français")
    timezone = models.CharField("fuseau horaire", max_length=60, default="Africa/Ouagadougou")

    risk_threshold = models.FloatField("seuil de risque élevé", default=0.7)
    medium_risk_threshold = models.FloatField("seuil de risque moyen", default=0.45)
    recommendations_count = models.PositiveSmallIntegerField("recommandations affichées", default=10)
    active_recommender = models.CharField(max_length=20, choices=Recommender.choices, default=Recommender.HYBRID)
    training_schedule = models.CharField("fréquence d'entraînement", max_length=80, default="Chaque nuit à 02:00")

    inactivity_days = models.PositiveSmallIntegerField("jours avant rappel d'inactivité", default=5)
    email_inactivity_reminder = models.BooleanField("rappel d'inactivité", default=True)
    email_instructor_alert = models.BooleanField("alerte au formateur", default=True)
    email_weekly_digest = models.BooleanField("résumé hebdomadaire", default=True)
    email_completion_congrats = models.BooleanField("félicitations de fin de cours", default=False)

    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "paramètres de la plateforme"
        verbose_name_plural = "paramètres de la plateforme"

    def __str__(self):
        return self.platform_name

    def save(self, *args, **kwargs):
        self.pk = 1
        super().save(*args, **kwargs)

    @classmethod
    def load(cls) -> "PlatformSettings":
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj


class ActivityLog(models.Model):
    """Journal des actions importantes (connexions, créations, modifications…)."""

    class Action(models.TextChoices):
        LOGIN = "login", "Connexion"
        CREATE = "create", "Création"
        UPDATE = "update", "Modification"
        DELETE = "delete", "Suppression"
        SYSTEM = "system", "Système"

    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="activity_logs"
    )
    actor_label = models.CharField(max_length=160, blank=True)
    action = models.CharField(max_length=20, choices=Action.choices, db_index=True)
    description = models.CharField(max_length=300)
    target_type = models.CharField(max_length=60, blank=True)
    target_id = models.CharField(max_length=60, blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "entrée du journal"
        verbose_name_plural = "journal d'activité"

    def __str__(self):
        return f"[{self.get_action_display()}] {self.description}"
