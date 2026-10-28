from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.administration.models import ActivityLog
from apps.administration.services import log_activity
from apps.core.permissions import IsAdminRole, IsInstructorOrAdmin, IsLearner
from apps.courses.models import Course
from apps.courses.serializers import CourseListSerializer
from apps.courses.services import with_stats
from apps.tracking.services import record_event

from .models import CourseEmbedding, ModelVersion, Recommendation, RecommendationFeedback, TrainingRun
from .pipeline import start_training, training_in_progress
from .services import TABS, ranked_recommendations, recommendation_payload, refresh_user_recommendations


class RecommendationListView(APIView):
    """Recommandations de l'apprenant connecté, par onglet."""

    permission_classes = [IsLearner]

    def get(self, request):
        from apps.administration.services import get_platform_settings

        tab = request.query_params.get("tab", "for_you")
        if tab not in TABS:
            tab = "for_you"
        try:
            limit = max(1, min(30, int(request.query_params.get("limit", get_platform_settings().recommendations_count))))
        except ValueError:
            limit = 10
        data = ranked_recommendations(request.user, tab, limit)
        recos = data["items"]
        courses = {
            c.id: c
            for c in with_stats(Course.objects.filter(id__in=[r.course_id for r in recos]))
            .select_related("category", "instructor")
            .prefetch_related("tags")
        }
        results = []
        for reco in recos:
            course = courses.get(reco.course_id)
            if course is None:
                continue
            item = CourseListSerializer(course, context={"match_scores": {course.id: round(reco.score, 3)}}).data
            item["recommendation"] = recommendation_payload(reco)
            results.append(item)
        return Response(
            {"tab": tab, "title": data["title"], "anchor": data["anchor"], "tabs": TABS, "results": results}
        )


class RecommendationFeedbackView(APIView):
    permission_classes = [IsLearner]

    def post(self, request, course_id, action):
        course = get_object_or_404(Course, pk=course_id)
        if action == "dismiss":
            RecommendationFeedback.objects.get_or_create(
                user=request.user, course=course, action=RecommendationFeedback.Action.DISMISSED
            )
            Recommendation.objects.filter(user=request.user, course=course).delete()
            record_event(request.user, "recommendation_dismiss", course=course)
            refresh_user_recommendations(request.user)
            return Response({"detail": "C'est noté : ce cours ne te sera plus proposé."})
        if action == "click":
            RecommendationFeedback.objects.get_or_create(
                user=request.user, course=course, action=RecommendationFeedback.Action.CLICKED
            )
            record_event(request.user, "recommendation_click", course=course)
            return Response({"ok": True})
        return Response({"detail": "Action inconnue.", "errors": {}}, status=status.HTTP_400_BAD_REQUEST)


def _run_payload(run: TrainingRun | None) -> dict | None:
    if run is None:
        return None
    return {
        "id": run.id,
        "status": run.status,
        "status_label": run.get_status_display(),
        "trigger": run.trigger,
        "triggered_by": run.triggered_by.full_name if run.triggered_by else None,
        "steps": run.steps,
        "summary": run.summary,
        "error": run.error[-500:] if run.error else "",
        "started_at": run.started_at,
        "finished_at": run.finished_at,
        "duration_seconds": run.duration_seconds,
    }


class MLOverviewView(APIView):
    """Tableau de bord des modèles : métriques, comparaison, carte des embeddings, historique."""

    permission_classes = [IsInstructorOrAdmin]

    def get(self, request):
        active = {v.kind: v for v in ModelVersion.objects.filter(is_active=True)}
        models = []
        for kind, label in ModelVersion.Kind.choices:
            version = active.get(kind)
            models.append(
                {
                    "kind": kind,
                    "label": label,
                    "version": version.version if version else None,
                    "metrics": version.metrics if version else {},
                    "params": version.params if version else {},
                    "n_samples": version.n_samples if version else 0,
                    "trained_at": version.trained_at if version else None,
                }
            )
        embeddings = CourseEmbedding.objects.select_related("course__category").filter(course__status=Course.Status.PUBLISHED)
        history = (
            ModelVersion.objects.filter(kind__in=[ModelVersion.Kind.HYBRID, ModelVersion.Kind.DROPOUT])
            .order_by("-trained_at")[:20]
        )
        runs = TrainingRun.objects.select_related("triggered_by")[:10]
        return Response(
            {
                "models": models,
                "embedding_map": [
                    {
                        "course_id": e.course_id,
                        "title": e.course.title,
                        "slug": e.course.slug,
                        "category": e.course.category.name,
                        "color": e.course.category.color,
                        "x": round(e.x, 4),
                        "y": round(e.y, 4),
                    }
                    for e in embeddings
                ],
                "history": [
                    {
                        "id": v.id,
                        "kind": v.kind,
                        "label": v.get_kind_display(),
                        "version": v.version,
                        "trained_at": v.trained_at,
                        "main_metric": v.metrics.get("ndcg_at_k") if v.kind == ModelVersion.Kind.HYBRID else v.metrics.get("auc"),
                        "metric_name": "NDCG@5" if v.kind == ModelVersion.Kind.HYBRID else "AUC",
                        "is_active": v.is_active,
                    }
                    for v in history
                ],
                "latest_run": _run_payload(runs[0] if runs else None),
                "runs": [_run_payload(r) for r in runs],
                "can_train": request.user.role == "admin",
                "training_in_progress": training_in_progress() is not None,
            }
        )


class TrainView(APIView):
    permission_classes = [IsAdminRole]

    def post(self, request):
        running = training_in_progress()
        if running:
            return Response(
                {"detail": "Un entraînement est déjà en cours.", "errors": {}, "run": _run_payload(running)},
                status=status.HTTP_409_CONFLICT,
            )
        run = start_training(request.user, "manual")
        log_activity(request.user, ActivityLog.Action.UPDATE, "Entraînement des modèles relancé", request)
        return Response(_run_payload(run), status=status.HTTP_202_ACCEPTED)


class TrainingRunView(APIView):
    permission_classes = [IsInstructorOrAdmin]

    def get(self, request, pk):
        run = get_object_or_404(TrainingRun.objects.select_related("triggered_by"), pk=pk)
        return Response(_run_payload(run))


class SimilarCoursesView(APIView):
    """Cours similaires (embeddings), utilisé sur la page détail d'un cours."""

    permission_classes = [IsAuthenticated]

    def get(self, request, slug):
        import numpy as np

        course = get_object_or_404(Course, slug=slug)
        vectors = dict(
            CourseEmbedding.objects.filter(course__status=Course.Status.PUBLISHED).values_list("course_id", "vector")
        )
        anchor = np.array(vectors.get(course.id) or [])
        if not anchor.size:
            return Response([])
        scored = sorted(
            ((cid, float(np.array(v) @ anchor)) for cid, v in vectors.items() if cid != course.id and len(v) == anchor.size),
            key=lambda x: -x[1],
        )[:4]
        courses = {
            c.id: c
            for c in with_stats(Course.objects.filter(id__in=[cid for cid, _ in scored]))
            .select_related("category", "instructor")
            .prefetch_related("tags")
        }
        return Response([CourseListSerializer(courses[cid]).data for cid, _ in scored if cid in courses])
