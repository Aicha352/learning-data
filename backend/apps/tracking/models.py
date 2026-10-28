from django.conf import settings
from django.db import models
from django.utils import timezone


class LearningEvent(models.Model):
    """Une action d'un apprenant sur la plateforme (la base de toute l'analyse)."""

    class Type(models.TextChoices):
        LOGIN = "login", "Connexion"
        COURSE_VIEW = "course_view", "Consultation d'un cours"
        ENROLL = "enroll", "Inscription à un cours"
        LESSON_OPEN = "lesson_open", "Ouverture d'une leçon"
        LESSON_TIME = "lesson_time", "Temps passé sur une leçon"
        VIDEO_PLAY = "video_play", "Lecture vidéo"
        VIDEO_PAUSE = "video_pause", "Pause vidéo"
        VIDEO_SEEK = "video_seek", "Retour / avance dans la vidéo"
        VIDEO_PROGRESS = "video_progress", "Progression vidéo"
        VIDEO_COMPLETE = "video_complete", "Vidéo terminée"
        LESSON_COMPLETE = "lesson_complete", "Leçon terminée"
        QUIZ_START = "quiz_start", "Début de quiz"
        HINT_USED = "hint_used", "Indice utilisé"
        QUIZ_SUBMIT = "quiz_submit", "Quiz envoyé"
        SEARCH = "search", "Recherche"
        RECO_CLICK = "recommendation_click", "Clic sur une recommandation"
        RECO_DISMISS = "recommendation_dismiss", "Recommandation refusée"

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="events")
    event_type = models.CharField(max_length=40, choices=Type.choices, db_index=True)
    course = models.ForeignKey("courses.Course", null=True, blank=True, on_delete=models.SET_NULL, related_name="events")
    lesson = models.ForeignKey("courses.Lesson", null=True, blank=True, on_delete=models.SET_NULL, related_name="events")
    value = models.FloatField(null=True, blank=True, help_text="Secondes, pourcentage ou score selon le type")
    metadata = models.JSONField(default=dict, blank=True)
    session_id = models.CharField(max_length=64, blank=True)
    created_at = models.DateTimeField(default=timezone.now, db_index=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "événement d'apprentissage"
        indexes = [
            models.Index(fields=["user", "created_at"]),
            models.Index(fields=["course", "created_at"]),
        ]

    def __str__(self):
        return f"{self.user_id} · {self.event_type} · {self.created_at:%Y-%m-%d %H:%M}"
