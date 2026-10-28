"""Choix partagés entre plusieurs applications."""
from django.db import models


class Level(models.TextChoices):
    BEGINNER = "beginner", "Débutant"
    INTERMEDIATE = "intermediate", "Intermédiaire"
    ADVANCED = "advanced", "Avancé"


LEVEL_ORDER = {Level.BEGINNER: 0, Level.INTERMEDIATE: 1, Level.ADVANCED: 2}
