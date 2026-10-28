"""Envoie les rappels automatiques. À planifier chaque jour (cron, planificateur Windows…)."""
from datetime import timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone

from apps.accounts.models import User
from apps.administration.models import ActivityLog
from apps.administration.services import get_platform_settings, log_activity
from apps.courses.models import Enrollment
from apps.engagement.models import Notification
from apps.engagement.services import notify
from apps.ml.models import DropoutPrediction


class Command(BaseCommand):
    help = "Rappels d'inactivité aux apprenants et alertes de risque aux formateurs."

    def add_arguments(self, parser):
        parser.add_argument("--weekly-digest", action="store_true", help="Envoie aussi le résumé hebdomadaire.")

    def handle(self, *args, **options):
        settings = get_platform_settings()
        now = timezone.now()
        reminders = alerts = digests = 0

        if settings.email_inactivity_reminder:
            limit = now - timedelta(days=settings.inactivity_days)
            recent_reminder = now - timedelta(days=7)
            enrollments = Enrollment.objects.filter(
                status=Enrollment.Status.ACTIVE,
                last_activity_at__lt=limit,
                last_activity_at__gte=now - timedelta(days=60),
                user__role=User.Role.LEARNER,
                user__status=User.Status.ACTIVE,
            ).select_related("user", "course")
            for enrollment in enrollments:
                already = Notification.objects.filter(
                    user=enrollment.user, kind=Notification.Kind.REMINDER, created_at__gte=recent_reminder
                ).exists()
                if already:
                    continue
                days = (now - enrollment.last_activity_at).days
                notify(
                    enrollment.user,
                    Notification.Kind.REMINDER,
                    f"Reprends « {enrollment.course.title} »",
                    f"Tu n'as pas avancé depuis {days} jours. Une leçon de 10 minutes suffit pour reprendre le rythme !",
                    f"/apprenant/apprendre/{enrollment.course.slug}",
                    send_email=True,
                )
                reminders += 1

        if settings.email_instructor_alert:
            since = now - timedelta(days=1)
            new_high = DropoutPrediction.objects.filter(
                level=DropoutPrediction.Level.HIGH, predicted_at__gte=since
            ).exclude(previous_score__gte=settings.risk_threshold).select_related("course__instructor", "user")
            per_instructor: dict[int, list] = {}
            for prediction in new_high:
                per_instructor.setdefault(prediction.course.instructor_id, []).append(prediction)
            for instructor_id, items in per_instructor.items():
                instructor = items[0].course.instructor
                names = ", ".join(p.user.full_name for p in items[:3])
                notify(
                    instructor,
                    Notification.Kind.ALERT,
                    f"{len(items)} apprenant(s) passé(s) en risque élevé",
                    f"{names}{'…' if len(items) > 3 else ''}",
                    "/formateur/risques",
                    send_email=True,
                )
                alerts += 1

        if options["weekly_digest"] and settings.email_weekly_digest:
            for user in User.objects.filter(role=User.Role.LEARNER, status=User.Status.ACTIVE, enrollments__status=Enrollment.Status.ACTIVE).distinct():
                notify(
                    user,
                    Notification.Kind.RECOMMENDATION,
                    "Ton résumé de la semaine",
                    "Découvre ta progression et tes nouvelles recommandations.",
                    "/apprenant/progression",
                    send_email=True,
                )
                digests += 1

        summary = f"Rappels automatiques : {reminders} apprenant(s), {alerts} formateur(s), {digests} résumé(s)"
        log_activity(None, ActivityLog.Action.SYSTEM, summary)
        self.stdout.write(self.style.SUCCESS(summary))
