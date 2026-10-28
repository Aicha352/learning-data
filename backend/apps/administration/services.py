"""Services d'administration : journal d'activité et paramètres."""
from apps.core.utils import client_ip

from .models import ActivityLog, PlatformSettings


def get_platform_settings() -> PlatformSettings:
    return PlatformSettings.load()


def log_activity(actor, action: str, description: str, request=None, target=None) -> ActivityLog:
    """Ajoute une ligne au journal. `actor` peut être None (action du système)."""
    if actor is not None and getattr(actor, "is_authenticated", False):
        label = actor.full_name
    else:
        actor = None
        label = "Système" if action == ActivityLog.Action.SYSTEM else "Inconnu"
    return ActivityLog.objects.create(
        actor=actor,
        actor_label=label,
        action=action,
        description=description[:300],
        target_type=target.__class__.__name__ if target is not None else "",
        target_id=str(getattr(target, "pk", "")) if target is not None else "",
        ip_address=client_ip(request),
    )
