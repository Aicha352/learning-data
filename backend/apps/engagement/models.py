from django.conf import settings
from django.db import models


class Notification(models.Model):
    class Kind(models.TextChoices):
        REMINDER = "reminder", "Rappel"
        MESSAGE = "message", "Message"
        RECOMMENDATION = "recommendation", "Recommandation"
        ALERT = "alert", "Alerte"
        ACHIEVEMENT = "achievement", "Réussite"
        SYSTEM = "system", "Système"

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="notifications")
    kind = models.CharField(max_length=20, choices=Kind.choices, default=Kind.SYSTEM)
    title = models.CharField(max_length=160)
    body = models.CharField(max_length=500, blank=True)
    link = models.CharField(max_length=300, blank=True)
    is_read = models.BooleanField(default=False, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return self.title


class Intervention(models.Model):
    """Action d'un formateur auprès d'un apprenant (message, rappel, tutorat…)."""

    class Kind(models.TextChoices):
        MESSAGE = "message", "Message"
        REMINDER = "reminder", "Rappel personnalisé"
        COURSE_SUGGESTION = "course_suggestion", "Suggestion de cours"
        TUTORING = "tutoring", "Tutorat"

    instructor = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL, related_name="interventions_sent"
    )
    learner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="interventions_received")
    course = models.ForeignKey("courses.Course", null=True, blank=True, on_delete=models.SET_NULL)
    suggested_course = models.ForeignKey(
        "courses.Course", null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )
    kind = models.CharField(max_length=30, choices=Kind.choices)
    message = models.TextField()
    scheduled_for = models.DateTimeField(null=True, blank=True)
    notification = models.ForeignKey(Notification, null=True, blank=True, on_delete=models.SET_NULL)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    @property
    def is_read(self) -> bool:
        return bool(self.notification and self.notification.is_read)
