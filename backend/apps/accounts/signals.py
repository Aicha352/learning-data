from django.db.models.signals import post_save
from django.dispatch import receiver

from .models import LearnerProfile, User


@receiver(post_save, sender=User)
def create_learner_profile(sender, instance: User, created: bool, **kwargs):
    """Chaque apprenant possède un profil (questionnaire d'accueil)."""
    if instance.role == User.Role.LEARNER:
        LearnerProfile.objects.get_or_create(user=instance)
