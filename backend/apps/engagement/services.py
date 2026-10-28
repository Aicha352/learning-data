"""Notifications, e-mails et interventions des formateurs."""
import logging

from django.conf import settings
from django.core.mail import send_mail

from .models import Intervention, Notification

logger = logging.getLogger(__name__)


def send_platform_email(user, subject: str, body: str, link: str = "") -> bool:
    """Envoie un e-mail (affiché dans la console en développement)."""
    if link:
        body = f"{body}\n\n{settings.FRONTEND_URL}{link}"
    try:
        send_mail(subject, body, settings.DEFAULT_FROM_EMAIL, [user.email], fail_silently=False)
        return True
    except Exception:  # pragma: no cover - dépend du serveur SMTP
        logger.exception("Échec de l'envoi d'un e-mail à %s", user.email)
        return False


def notify(user, kind: str, title: str, body: str = "", link: str = "", send_email: bool = False) -> Notification:
    notification = Notification.objects.create(user=user, kind=kind, title=title[:160], body=body[:500], link=link[:300])
    if send_email:
        send_platform_email(user, title, body, link)
    return notification


INTERVENTION_TITLES = {
    Intervention.Kind.MESSAGE: "Nouveau message de {instructor}",
    Intervention.Kind.REMINDER: "{instructor} t'encourage à reprendre ton cours",
    Intervention.Kind.COURSE_SUGGESTION: "{instructor} te suggère un cours",
    Intervention.Kind.TUTORING: "{instructor} te propose une séance de tutorat",
}


def create_intervention(instructor, learner, kind: str, message: str, course=None, suggested_course=None, scheduled_for=None):
    if suggested_course is not None:
        link = f"/cours/{suggested_course.slug}"
    elif course is not None:
        link = f"/apprenant/apprendre/{course.slug}"
    else:
        link = "/apprenant"
    notification = notify(
        learner,
        Notification.Kind.MESSAGE,
        INTERVENTION_TITLES.get(kind, "Message de {instructor}").format(instructor=instructor.full_name),
        message,
        link,
        send_email=True,
    )
    return Intervention.objects.create(
        instructor=instructor,
        learner=learner,
        course=course,
        suggested_course=suggested_course,
        kind=kind,
        message=message,
        scheduled_for=scheduled_for,
        notification=notification,
    )
