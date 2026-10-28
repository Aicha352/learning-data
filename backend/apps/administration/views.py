"""API d'administration : tableau de bord, comptes, rôles, validation des cours, paramètres, journal."""
import secrets
from datetime import timedelta

from django.db import connection
from django.db.models import Count, Q
from django.db.models.functions import TruncMonth
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import User
from apps.accounts.serializers import AdminUserCreateSerializer, AdminUserSerializer, AdminUserUpdateSerializer
from apps.core.permissions import IsAdminRole
from apps.core.utils import csv_response, period_start
from apps.courses.models import Course, Enrollment
from apps.courses.serializers import InstructorCourseDetailSerializer, InstructorCourseListSerializer
from apps.courses.services import with_stats
from apps.engagement.models import Notification
from apps.engagement.services import notify, send_platform_email
from apps.ml.models import TrainingRun
from apps.tracking.models import LearningEvent

from .models import ActivityLog, PlatformSettings
from .serializers import ActivityLogSerializer, CourseReviewDecisionSerializer, PlatformSettingsSerializer
from .services import get_platform_settings, log_activity

MONTHS_FR = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."]


class AdminDashboardView(APIView):
    permission_classes = [IsAdminRole]

    def get(self, request):
        now = timezone.now()
        month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        prev_month_start = (month_start - timedelta(days=1)).replace(day=1)

        users = User.objects.all()
        by_role = dict(users.values("role").annotate(n=Count("id")).values_list("role", "n"))
        new_this_month = users.filter(date_joined__gte=month_start).count()
        new_prev_month = users.filter(date_joined__gte=prev_month_start, date_joined__lt=month_start).count()
        enroll_this_month = Enrollment.objects.filter(enrolled_at__gte=month_start).count()
        enroll_prev_month = Enrollment.objects.filter(enrolled_at__gte=prev_month_start, enrolled_at__lt=month_start).count()
        published = Course.objects.published()

        twelve = (month_start - timedelta(days=330)).replace(day=1)
        monthly = dict(
            users.filter(date_joined__gte=twelve)
            .annotate(month=TruncMonth("date_joined"))
            .values("month")
            .annotate(n=Count("id"))
            .values_list("month", "n")
        )
        series, cursor = [], twelve
        for _ in range(12):
            key = next((m for m in monthly if m.year == cursor.year and m.month == cursor.month), None)
            series.append({"label": MONTHS_FR[cursor.month - 1], "year": cursor.year, "value": monthly.get(key, 0) if key else 0})
            cursor = (cursor + timedelta(days=32)).replace(day=1)

        active_month = (
            LearningEvent.objects.filter(created_at__gte=now - timedelta(days=30)).values("user_id").distinct().count()
        )
        last_run = TrainingRun.objects.first()
        try:
            with connection.cursor() as cursor_db:
                cursor_db.execute("SELECT version()")
                db_version = cursor_db.fetchone()[0].split(" on ")[0].split(" (")[0]
            db_ok = True
        except Exception:  # pragma: no cover
            db_version, db_ok = "indisponible", False
        notifications_month = Notification.objects.filter(created_at__gte=now - timedelta(days=30)).count()

        return Response(
            {
                "kpis": {
                    "users": users.count(),
                    "users_delta": round(100 * (new_this_month - new_prev_month) / new_prev_month, 1) if new_prev_month else None,
                    "instructors": by_role.get(User.Role.INSTRUCTOR, 0),
                    "instructors_new": users.filter(role=User.Role.INSTRUCTOR, date_joined__gte=month_start).count(),
                    "published_courses": published.count(),
                    "published_new": published.filter(published_at__gte=month_start).count(),
                    "enrollments_month": enroll_this_month,
                    "enrollments_delta": round(100 * (enroll_this_month - enroll_prev_month) / enroll_prev_month, 1) if enroll_prev_month else None,
                },
                "monthly_signups": series,
                "accounts": {
                    "learners": by_role.get(User.Role.LEARNER, 0),
                    "instructors": by_role.get(User.Role.INSTRUCTOR, 0),
                    "admins": by_role.get(User.Role.ADMIN, 0),
                    "active_month": active_month,
                },
                "todo": {
                    "pending_courses": Course.objects.filter(status=Course.Status.PENDING).count(),
                    "oldest_pending_days": _oldest_pending_days(),
                    "pending_instructors": users.filter(role=User.Role.INSTRUCTOR, status=User.Status.PENDING).count(),
                    "suspended_users": users.filter(status=User.Status.SUSPENDED).count(),
                },
                "system": {
                    "database": {"ok": db_ok, "label": db_version},
                    "training": {
                        "ok": bool(last_run and last_run.status == TrainingRun.Status.SUCCESS),
                        "status": last_run.status if last_run else None,
                        "label": (
                            f"{last_run.get_status_display()} · {timezone.localtime(last_run.started_at):%d/%m à %H:%M}"
                            if last_run
                            else "Jamais lancé"
                        ),
                    },
                    "notifications": {"ok": True, "label": f"{notifications_month} envoyées (30 j)"},
                    "api": {"ok": True, "label": "En ligne"},
                },
            }
        )


def _oldest_pending_days() -> int | None:
    oldest = Course.objects.filter(status=Course.Status.PENDING, submitted_at__isnull=False).order_by("submitted_at").first()
    return (timezone.now() - oldest.submitted_at).days if oldest else None


class AdminUserViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.CreateModelMixin,
    mixins.UpdateModelMixin,
    mixins.DestroyModelMixin,
    viewsets.GenericViewSet,
):
    permission_classes = [IsAdminRole]
    search_fields = ["first_name", "last_name", "email"]
    ordering_fields = ["date_joined", "last_login", "last_name", "email"]
    filterset_fields = ["role", "status"]

    def get_queryset(self):
        return User.objects.annotate(
            enrollments_count=Count("enrollments", distinct=True),
            courses_count=Count("taught_courses", distinct=True),
        ).order_by("-date_joined")

    def get_serializer_class(self):
        if self.action == "create":
            return AdminUserCreateSerializer
        if self.action in {"update", "partial_update"}:
            return AdminUserUpdateSerializer
        return AdminUserSerializer

    def create(self, request, *args, **kwargs):
        serializer = AdminUserCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        password = secrets.token_urlsafe(9)
        user = User.objects.create_user(password=password, status=User.Status.ACTIVE, **serializer.validated_data)
        send_platform_email(
            user,
            "Ton compte Learning Data",
            f"Bonjour {user.first_name},\n\nUn compte {user.get_role_display().lower()} a été créé pour toi.\n"
            f"Identifiant : {user.email}\nMot de passe temporaire : {password}\n\nPense à le changer après ta première connexion.",
            "/connexion",
        )
        log_activity(request.user, ActivityLog.Action.CREATE, f"Compte {user.get_role_display().lower()} créé pour {user.email}", request, user)
        data = AdminUserSerializer(self.get_queryset().get(pk=user.pk)).data
        data["temporary_password"] = password
        return Response(data, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop("partial", False)
        user = self.get_object()
        before = (user.role, user.status)
        serializer = AdminUserUpdateSerializer(user, data=request.data, partial=partial, context={"request": request})
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        changes = []
        if before[0] != user.role:
            changes.append(f"rôle → {user.get_role_display().lower()}")
        if before[1] != user.status:
            changes.append(f"statut → {user.get_status_display().lower()}")
            if before[1] == User.Status.PENDING and user.status == User.Status.ACTIVE:
                notify(user, Notification.Kind.SYSTEM, "Ton compte est validé", "Tu peux maintenant te connecter.", "/connexion", send_email=True)
        log_activity(
            request.user,
            ActivityLog.Action.UPDATE,
            f"Compte de {user.full_name} modifié" + (f" ({', '.join(changes)})" if changes else ""),
            request,
            user,
        )
        return Response(AdminUserSerializer(self.get_queryset().get(pk=user.pk)).data)

    def destroy(self, request, *args, **kwargs):
        user = self.get_object()
        if user == request.user:
            return Response({"detail": "Tu ne peux pas supprimer ton propre compte.", "errors": {}}, status=400)
        if user.taught_courses.exists():
            return Response(
                {"detail": "Ce formateur a des cours : suspends plutôt son compte.", "errors": {}}, status=400
            )
        label = f"{user.full_name} ({user.email})"
        user.delete()
        log_activity(request.user, ActivityLog.Action.DELETE, f"Compte supprimé : {label}", request)
        return Response(status=status.HTTP_204_NO_CONTENT)

    def _set_status(self, request, new_status, verb):
        user = self.get_object()
        if user == request.user:
            return Response({"detail": "Tu ne peux pas modifier le statut de ton propre compte.", "errors": {}}, status=400)
        previous = user.status
        user.status = new_status
        user.save(update_fields=["status"])
        if previous == User.Status.PENDING and new_status == User.Status.ACTIVE:
            notify(user, Notification.Kind.SYSTEM, "Ton compte formateur est validé", "Tu peux maintenant te connecter et créer tes cours.", "/connexion", send_email=True)
        log_activity(request.user, ActivityLog.Action.UPDATE, f"Compte de {user.full_name} {verb}", request, user)
        return Response(AdminUserSerializer(self.get_queryset().get(pk=user.pk)).data)

    @action(detail=True, methods=["post"])
    def suspend(self, request, pk=None):
        return self._set_status(request, User.Status.SUSPENDED, "suspendu")

    @action(detail=True, methods=["post"])
    def activate(self, request, pk=None):
        return self._set_status(request, User.Status.ACTIVE, "activé")

    @action(detail=True, methods=["post"], url_path="reset-password")
    def reset_password(self, request, pk=None):
        user = self.get_object()
        password = secrets.token_urlsafe(9)
        user.set_password(password)
        user.save(update_fields=["password"])
        send_platform_email(user, "Réinitialisation de ton mot de passe", f"Ton nouveau mot de passe temporaire : {password}", "/connexion")
        log_activity(request.user, ActivityLog.Action.UPDATE, f"Mot de passe réinitialisé pour {user.full_name}", request, user)
        return Response({"temporary_password": password})


ROLE_PERMISSIONS = [
    ("Suivre des cours et passer les quiz", True, True, True),
    ("Recevoir des recommandations personnalisées", True, False, False),
    ("Créer et modifier ses propres cours", False, True, True),
    ("Voir le risque de décrochage de ses apprenants", False, True, True),
    ("Contacter les apprenants", False, True, True),
    ("Consulter les learning analytics", False, True, True),
    ("Publier un cours sans validation", False, False, True),
    ("Valider les cours des formateurs", False, False, True),
    ("Gérer les comptes utilisateurs", False, False, True),
    ("Modifier les paramètres de la plateforme", False, False, True),
    ("Relancer l'entraînement des modèles ML", False, False, True),
    ("Consulter le journal d'activité", False, False, True),
]


class RolesView(APIView):
    permission_classes = [IsAdminRole]

    def get(self, request):
        counts = dict(User.objects.values("role").annotate(n=Count("id")).values_list("role", "n"))
        return Response(
            {
                "roles": [
                    {"key": User.Role.LEARNER, "label": "Apprenant", "count": counts.get(User.Role.LEARNER, 0),
                     "description": "Suit des cours, passe les quiz et reçoit des recommandations."},
                    {"key": User.Role.INSTRUCTOR, "label": "Formateur", "count": counts.get(User.Role.INSTRUCTOR, 0),
                     "description": "Crée ses cours et suit ses apprenants et leur risque de décrochage."},
                    {"key": User.Role.ADMIN, "label": "Administrateur", "count": counts.get(User.Role.ADMIN, 0),
                     "description": "Gère les comptes, valide les cours et configure la plateforme."},
                ],
                "permissions": [
                    {"label": label, "learner": a, "instructor": b, "admin": c} for label, a, b, c in ROLE_PERMISSIONS
                ],
            }
        )


class CourseReviewListView(APIView):
    permission_classes = [IsAdminRole]

    def get(self, request):
        status_filter = request.query_params.get("status", "pending")
        qs = with_stats(Course.objects.all()).select_related("category", "instructor").order_by("submitted_at", "-updated_at")
        if status_filter != "all":
            qs = qs.filter(status=status_filter)
        return Response(InstructorCourseListSerializer(qs[:100], many=True).data)


class CourseReviewDetailView(APIView):
    permission_classes = [IsAdminRole]

    def get_course(self, pk):
        qs = (
            with_stats(Course.objects.all())
            .select_related("category", "instructor")
            .prefetch_related("tags", "modules__lessons", "modules__quiz")
        )
        return get_object_or_404(qs, pk=pk)

    def get(self, request, pk):
        return Response(InstructorCourseDetailSerializer(self.get_course(pk), context={"request": request}).data)

    def post(self, request, pk):
        course = self.get_course(pk)
        serializer = CourseReviewDecisionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        decision = serializer.validated_data["decision"]
        comment = serializer.validated_data.get("comment", "").strip()
        course.review_comment = comment
        course.reviewed_by = request.user
        if decision == "approve":
            course.status = Course.Status.PUBLISHED
            course.published_at = course.published_at or timezone.now()
            title, body = "Ton cours est publié 🎉", f"« {course.title} » est maintenant visible dans le catalogue."
            verb = "approuvé et publié"
        elif decision == "request_changes":
            course.status = Course.Status.CHANGES_REQUESTED
            title, body = "Modifications demandées", f"« {course.title} » : {comment}"
            verb = "renvoyé pour modifications"
        else:
            course.status = Course.Status.REJECTED
            title, body = "Cours refusé", f"« {course.title} » : {comment}"
            verb = "refusé"
        course.save()
        notify(course.instructor, Notification.Kind.SYSTEM, title, body, f"/formateur/cours/{course.id}", send_email=True)
        log_activity(request.user, ActivityLog.Action.UPDATE, f"Cours « {course.title} » {verb}", request, course)
        if decision == "approve":
            from apps.ml.services import rebuild_recommender_state

            rebuild_recommender_state()
        return Response(InstructorCourseDetailSerializer(self.get_course(pk), context={"request": request}).data)


class PlatformSettingsView(APIView):
    permission_classes = [IsAdminRole]

    def get(self, request):
        return Response(PlatformSettingsSerializer(get_platform_settings()).data)

    def put(self, request):
        settings = get_platform_settings()
        before = PlatformSettingsSerializer(settings).data
        serializer = PlatformSettingsSerializer(settings, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        settings = serializer.save()
        after = PlatformSettingsSerializer(settings).data
        changed = [k for k in after if k != "updated_at" and before.get(k) != after.get(k)]
        if changed:
            details = []
            labels = {f.name: f.verbose_name for f in PlatformSettings._meta.fields}
            for key in changed[:3]:
                details.append(f"{labels.get(key, key)} : {_fmt(before[key])} → {_fmt(after[key])}")
            log_activity(request.user, ActivityLog.Action.UPDATE, "Paramètres modifiés — " + " ; ".join(details), request)
        return Response(after)


def _fmt(value):
    if isinstance(value, bool):
        return "activé" if value else "désactivé"
    if isinstance(value, float) and value <= 1:
        return f"{round(value * 100)} %"
    return str(value)


class ActivityLogView(APIView):
    permission_classes = [IsAdminRole]

    def get_queryset(self, request):
        qs = ActivityLog.objects.select_related("actor")
        action_filter = request.query_params.get("action")
        if action_filter:
            qs = qs.filter(action=action_filter)
        query = request.query_params.get("q", "").strip()
        if query:
            qs = qs.filter(Q(actor_label__icontains=query) | Q(description__icontains=query) | Q(ip_address__icontains=query))
        start = period_start(request.query_params.get("period", "7d"))
        if start:
            qs = qs.filter(created_at__gte=start)
        return qs

    def get(self, request):
        from apps.core.pagination import StandardPagination

        qs = self.get_queryset(request)
        if request.query_params.get("export") == "csv":
            return csv_response(
                "journal-activite.csv",
                ["Date", "Utilisateur", "Type", "Détail", "Adresse IP"],
                (
                    [timezone.localtime(l.created_at).strftime("%d/%m/%Y %H:%M"), l.actor_label, l.get_action_display(), l.description, l.ip_address or ""]
                    for l in qs[:10000]
                ),
            )
        paginator = StandardPagination()
        paginator.page_size = 15
        page = paginator.paginate_queryset(qs, request, view=self)
        return paginator.get_paginated_response(ActivityLogSerializer(page, many=True).data)
