from django.db import connection
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView


class HealthView(APIView):
    """Vérifie que l'API et la base de données répondent."""

    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request):
        try:
            with connection.cursor() as cursor:
                cursor.execute("SELECT 1")
            database = "ok"
        except Exception:  # pragma: no cover - dépend de l'infrastructure
            database = "erreur"
        return Response({"status": "ok" if database == "ok" else "degraded", "database": database})


class PublicStatsView(APIView):
    """Chiffres affichés sur la page d'accueil."""

    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request):
        from apps.accounts.models import User
        from apps.courses.models import Course, Enrollment

        enrollments = Enrollment.objects.count()
        completed = Enrollment.objects.filter(status=Enrollment.Status.COMPLETED).count()
        return Response(
            {
                "learners": User.objects.filter(role=User.Role.LEARNER).count(),
                "courses": Course.objects.published().count(),
                "instructors": User.objects.filter(role=User.Role.INSTRUCTOR, status=User.Status.ACTIVE).count(),
                "completion_rate": round(completed / enrollments, 3) if enrollments else 0,
            }
        )
