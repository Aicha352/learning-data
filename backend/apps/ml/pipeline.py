"""Pipeline complet : collecte → nettoyage → entraînement → évaluation → déploiement.

Lancé chaque nuit (commande `python manage.py train_models`) ou depuis l'interface admin.
"""
from __future__ import annotations

import logging
import threading
import time
import traceback
from datetime import timedelta

import pandas as pd
from django.conf import settings
from django.db import close_old_connections, connection, transaction
from django.utils import timezone

from apps.accounts.models import User
from apps.courses.models import Enrollment
from apps.tracking.models import LearningEvent

from . import artifacts
from .data import load_activity_frames, load_catalog, load_interactions, load_profiles, to_epoch
from .dropout import FEATURES, DropoutModel, FeatureBuilder, build_training_set, risk_level
from .evaluation import evaluate_recommenders
from .models import DropoutPrediction, LearnerSegment, ModelVersion, TrainingRun
from .recommenders import HybridWeights
from .segments import cluster_learners, learner_behaviour
from .services import (
    RECOMMENDER_ARTIFACT,
    build_recommender_state,
    compute_for_users,
    save_course_embeddings,
    write_recommendations,
)

logger = logging.getLogger(__name__)

# Au-delà, l'apprenant a déjà décroché : on ne prédit plus, il apparaît comme « inactif ».
PREDICTION_WINDOW_DAYS = 35

STEPS = [
    ("collecte", "Collecte"),
    ("nettoyage", "Nettoyage"),
    ("entrainement", "Entraînement"),
    ("evaluation", "Évaluation"),
    ("deploiement", "Déploiement API"),
]


def fr_number(value: int) -> str:
    return f"{value:,}".replace(",", " ")


class PipelineRunner:
    def __init__(self, run: TrainingRun):
        self.run = run
        self.context: dict = {}
        self.run.steps = [{"key": k, "label": l, "status": "pending", "detail": ""} for k, l in STEPS]
        self.run.save(update_fields=["steps"])

    def _update_step(self, key, **values):
        for step in self.run.steps:
            if step["key"] == key:
                step.update(values)
        self.run.save(update_fields=["steps"])

    def execute(self):
        try:
            for key, _ in STEPS:
                self._update_step(key, status="running", started_at=timezone.now().isoformat())
                start = time.monotonic()
                detail = getattr(self, f"step_{key}")()
                self._update_step(
                    key,
                    status="success",
                    detail=detail,
                    finished_at=timezone.now().isoformat(),
                    seconds=round(time.monotonic() - start, 2),
                )
            self.run.status = TrainingRun.Status.SUCCESS
        except Exception as exc:  # on garde la trace pour l'interface
            logger.exception("Échec du pipeline d'entraînement")
            for step in self.run.steps:
                if step["status"] == "running":
                    step["status"] = "failed"
                    step["detail"] = str(exc)[:300]
            self.run.status = TrainingRun.Status.FAILED
            self.run.error = traceback.format_exc()[-4000:]
        self.run.finished_at = timezone.now()
        self.run.save()
        if self.run.status == TrainingRun.Status.SUCCESS:
            from apps.administration.models import ActivityLog
            from apps.administration.services import log_activity

            hybrid = self.context.get("evaluation", {}).get("hybrid", {})
            log_activity(
                None,
                ActivityLog.Action.SYSTEM,
                f"Modèles réentraînés · hybride NDCG@5 = {hybrid.get('ndcg_at_k', 0):.2f}".replace(".", ","),
            )
        return self.run

    # --- 1. Collecte ---------------------------------------------------------------
    def step_collecte(self) -> str:
        now = timezone.now()
        total = LearningEvent.objects.count()
        last_day = LearningEvent.objects.filter(created_at__gte=now - timedelta(days=1)).count()
        self.context["frames"] = load_activity_frames()
        self.context["catalog"] = load_catalog()
        self.context["interactions"] = load_interactions()
        learners = self.context["interactions"]["user_id"].nunique()
        self.run.summary.update({"events_total": total, "events_last_day": last_day, "learners": int(learners)})
        return f"{fr_number(last_day)} événements reçus ces dernières 24 h ({fr_number(total)} au total)"

    # --- 2. Nettoyage --------------------------------------------------------------
    def step_nettoyage(self) -> str:
        frames = self.context["frames"]
        events = frames["events"]
        missing = int(events["value"].isna().sum())
        builder = FeatureBuilder(frames)
        self.context["builder"] = builder
        # Progressions hors bornes (sécurité) corrigées directement en base.
        fixed = Enrollment.objects.filter(progress__gt=1).update(progress=1.0)
        fixed += Enrollment.objects.filter(progress__lt=0).update(progress=0.0)
        interactions = self.context["interactions"]
        catalog = self.context["catalog"]
        before = len(interactions)
        interactions = interactions[interactions["course_id"].isin(catalog.index)].drop_duplicates(["user_id", "course_id"])
        self.context["interactions"] = interactions
        return (
            f"{fr_number(builder.duplicates_removed)} doublons ignorés, "
            f"{fr_number(missing)} valeurs manquantes complétées, {before - len(interactions) + fixed} lignes corrigées"
        )

    # --- 3. Entraînement -----------------------------------------------------------
    def step_entrainement(self) -> str:
        catalog = self.context["catalog"]
        interactions = self.context["interactions"]
        profiles = load_profiles()
        self.context["profiles"] = profiles

        evaluation = evaluate_recommenders(interactions, catalog, profiles)
        self.context["evaluation"] = evaluation
        weights = HybridWeights(**evaluation["weights"]) if "weights" in evaluation else HybridWeights()
        self.context["state"] = build_recommender_state(weights)

        now = timezone.now()
        dataset = build_training_set(self.context["builder"], to_epoch(pd.Series([pd.Timestamp(now)]))[0])
        self.context["dropout_dataset_size"] = len(dataset)
        dropout_model = DropoutModel()
        if len(dataset) >= 40 and dataset["label"].nunique() == 2:
            self.context["dropout_metrics"] = dropout_model.fit(dataset)
            self.context["dropout_model"] = dropout_model
        else:
            self.context["dropout_metrics"] = {"error": "Pas assez de données d'abandon pour entraîner le modèle."}

        frames = self.context["frames"]
        behaviour = learner_behaviour(frames["events"], frames["attempts"], pd.Timestamp(now - timedelta(days=60)))
        clustered, summary = cluster_learners(behaviour)
        self.context["segments"] = (clustered, summary)
        return (
            f"4 modèles entraînés sur {fr_number(len(interactions))} inscriptions et "
            f"{fr_number(len(dataset))} exemples d'abandon"
        )

    # --- 4. Évaluation -------------------------------------------------------------
    def step_evaluation(self) -> str:
        evaluation = self.context["evaluation"]
        if "error" in evaluation:
            return evaluation["error"]
        previous = ModelVersion.objects.filter(kind=ModelVersion.Kind.HYBRID, is_active=True).first()
        hybrid = evaluation["hybrid"]["ndcg_at_k"]
        text = f"Hybride NDCG@5 = {hybrid:.2f}".replace(".", ",")
        if previous and previous.metrics.get("ndcg_at_k") is not None:
            text += f" (version précédente : {previous.metrics['ndcg_at_k']:.2f})".replace(".", ",")
        auc = self.context["dropout_metrics"].get("auc")
        if auc is not None:
            text += f" · abandon AUC = {auc:.2f}".replace(".", ",")
        return text

    # --- 5. Déploiement ------------------------------------------------------------
    def step_deploiement(self) -> str:
        from apps.administration.services import get_platform_settings

        state = self.context["state"]
        evaluation = self.context["evaluation"]
        n_interactions = len(self.context["interactions"])
        n_reco = 0
        if state is not None:
            artifacts.save(RECOMMENDER_ARTIFACT, state)
            save_course_embeddings(state)
            learner_ids = list(User.objects.filter(role=User.Role.LEARNER).values_list("id", flat=True))
            for start in range(0, len(learner_ids), 300):
                chunk = learner_ids[start : start + 300]
                objects = compute_for_users(state, chunk)
                write_recommendations(chunk, objects)
                n_reco += len(objects)

        platform = get_platform_settings()
        n_predictions = 0
        model = self.context.get("dropout_model")
        if model is not None:
            artifacts.save("dropout", model)
            n_predictions = predict_current_risks(model, self.context["builder"], platform)

        clustered, summary = self.context["segments"]
        with transaction.atomic():
            LearnerSegment.objects.all().delete()
            LearnerSegment.objects.bulk_create(
                [
                    LearnerSegment(
                        user_id=int(row.user_id),
                        segment=row.segment,
                        features={k: round(float(getattr(row, k)), 2) for k in ("active_days", "minutes_per_day", "weekend_share", "video_completion", "quiz_avg")},
                    )
                    for row in clustered.itertuples(index=False)
                ],
                batch_size=1000,
            )

        with transaction.atomic():
            for kind in (ModelVersion.Kind.POPULARITY, ModelVersion.Kind.COLLABORATIVE, ModelVersion.Kind.CONTENT, ModelVersion.Kind.HYBRID):
                metrics = evaluation.get(kind, {})
                if not metrics:
                    continue
                params = {"weights": evaluation.get("weights")} if kind == ModelVersion.Kind.HYBRID else {}
                if kind == ModelVersion.Kind.CONTENT and state is not None:
                    params = {"dimension": int(state.content.embeddings.shape[1]), "n_courses": len(state.catalog.courses)}
                    metrics = {**metrics, "coverage": round(_coverage(), 3)}
                self._activate(kind, metrics, params, n_interactions)
            if model is not None:
                self._activate(ModelVersion.Kind.DROPOUT, self.context["dropout_metrics"], {"features": FEATURES, "model": "Régression logistique"}, self.context["dropout_dataset_size"])
            if summary:
                self._activate(ModelVersion.Kind.SEGMENTS, {"segments": summary}, {"k": len(summary)}, len(clustered))

        self.run.summary.update({"recommendations": n_reco, "predictions": n_predictions})
        return f"{fr_number(n_reco)} recommandations et {fr_number(n_predictions)} prédictions servies par l'API"

    def _activate(self, kind, metrics, params, n_samples):
        last = ModelVersion.objects.filter(kind=kind).order_by("-version").first()
        ModelVersion.objects.filter(kind=kind, is_active=True).update(is_active=False)
        ModelVersion.objects.create(
            kind=kind,
            version=(last.version + 1) if last else 1,
            metrics=metrics,
            params=params,
            n_samples=n_samples,
            is_active=True,
            training_run=self.run,
        )


def _coverage() -> float:
    from apps.courses.models import Course
    from .models import Recommendation

    published = Course.objects.published().count()
    recommended = Recommendation.objects.filter(rank__lte=10).values("course_id").distinct().count()
    return recommended / published if published else 0.0


def predict_current_risks(model: DropoutModel, builder: FeatureBuilder, platform) -> int:
    """Prédit le risque d'abandon de toutes les inscriptions en cours."""
    now = timezone.now()
    now_epoch = to_epoch(pd.Series([pd.Timestamp(now)]))[0]
    enrollments = list(
        Enrollment.objects.filter(
            status=Enrollment.Status.ACTIVE,
            user__role=User.Role.LEARNER,
            last_activity_at__gte=now - timedelta(days=PREDICTION_WINDOW_DAYS),
        ).values("id", "user_id", "course_id", "enrolled_at")
    )
    if not enrollments:
        DropoutPrediction.objects.all().delete()
        return 0
    rows = [
        builder.features(e["user_id"], e["course_id"], to_epoch(pd.Series([pd.Timestamp(e["enrolled_at"])]))[0], now_epoch)
        for e in enrollments
    ]
    scores = model.predict(rows)
    previous = dict(DropoutPrediction.objects.values_list("enrollment_id", "score"))
    objects = []
    for e, row, score in zip(enrollments, rows, scores):
        objects.append(
            DropoutPrediction(
                enrollment_id=e["id"],
                user_id=e["user_id"],
                course_id=e["course_id"],
                score=round(float(score), 4),
                previous_score=previous.get(e["id"]),
                level=risk_level(float(score), platform.risk_threshold, platform.medium_risk_threshold),
                contributions=model.explain(row),
                features=row,
                predicted_at=now,
            )
        )
    with transaction.atomic():
        DropoutPrediction.objects.all().delete()
        DropoutPrediction.objects.bulk_create(objects, batch_size=1000)
    return len(objects)


def start_training(user=None, trigger: str = "manual", background: bool | None = None) -> TrainingRun:
    run = TrainingRun.objects.create(triggered_by=user, trigger=trigger)
    background = settings.ML_TRAIN_IN_BACKGROUND if background is None else background
    if background:
        thread = threading.Thread(target=_run_in_thread, args=(run.pk,), daemon=True)
        thread.start()
    else:
        PipelineRunner(run).execute()
    return run


def _run_in_thread(run_id: int):
    close_old_connections()
    try:
        run = TrainingRun.objects.get(pk=run_id)
        PipelineRunner(run).execute()
    finally:
        connection.close()


def training_in_progress() -> TrainingRun | None:
    limit = timezone.now() - timedelta(minutes=30)
    return TrainingRun.objects.filter(status=TrainingRun.Status.RUNNING, started_at__gte=limit).first()

