"""Services ML utilisés par l'API : recommandations par apprenant et explications."""
from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import timedelta

import numpy as np
from django.db import transaction
from django.db.models import Count
from django.utils import timezone

from apps.courses.models import Course, Enrollment

from . import artifacts
from .data import Catalog, load_catalog, load_dismissed, load_interactions, load_profiles
from .models import CourseEmbedding, ModelVersion, Recommendation
from .recommenders import (
    ContentRecommender,
    HybridRecommender,
    HybridWeights,
    ItemCollaborativeRecommender,
    PopularityRecommender,
    ProfileScorer,
)

logger = logging.getLogger(__name__)

RECOMMENDER_ARTIFACT = "recommender"


@dataclass
class RecommenderState:
    catalog: Catalog
    collaborative: ItemCollaborativeRecommender
    content: ContentRecommender
    popularity: PopularityRecommender
    weights: HybridWeights

    def hybrid(self) -> HybridRecommender:
        return HybridRecommender(self.catalog, self.collaborative, self.content, ProfileScorer(), self.weights)


def current_weights() -> HybridWeights:
    version = ModelVersion.objects.filter(kind=ModelVersion.Kind.HYBRID, is_active=True).first()
    if version and version.params.get("weights"):
        w = version.params["weights"]
        return HybridWeights(w["collaborative"], w["content"], w["profile"])
    return HybridWeights()


def user_matrix(interactions, user_ids: list[int], catalog: Catalog) -> np.ndarray:
    from .evaluation import build_matrix

    return build_matrix(interactions, user_ids, catalog)


def build_recommender_state(weights: HybridWeights | None = None) -> RecommenderState | None:
    catalog = load_catalog()
    if len(catalog.courses) < 3:
        return None
    interactions = load_interactions()
    user_ids = sorted(interactions["user_id"].unique().tolist())
    matrix = user_matrix(interactions, user_ids, catalog) if user_ids else np.zeros((1, len(catalog.courses)))
    return RecommenderState(
        catalog=catalog,
        collaborative=ItemCollaborativeRecommender().fit(matrix),
        content=ContentRecommender().fit(catalog),
        popularity=PopularityRecommender().fit(matrix),
        weights=weights or current_weights(),
    )


def save_course_embeddings(state: RecommenderState):
    with transaction.atomic():
        CourseEmbedding.objects.exclude(course_id__in=state.catalog.ids).delete()
        for i, course in enumerate(state.catalog.courses):
            CourseEmbedding.objects.update_or_create(
                course_id=course.id,
                defaults={
                    "vector": [round(float(v), 5) for v in state.content.embeddings[i]],
                    "x": float(state.content.coords[i][0]),
                    "y": float(state.content.coords[i][1]),
                },
            )


def rebuild_recommender_state() -> RecommenderState | None:
    """Recalcule la similarité entre cours (après publication d'un nouveau cours, par exemple)."""
    state = build_recommender_state()
    if state is not None:
        artifacts.save(RECOMMENDER_ARTIFACT, state)
        save_course_embeddings(state)
    return state


def get_state() -> RecommenderState | None:
    state = artifacts.load(RECOMMENDER_ARTIFACT)
    if state is None:
        state = rebuild_recommender_state()
    return state


def compute_for_users(state: RecommenderState, user_ids: list[int]) -> list[Recommendation]:
    """Calcule les recommandations (score hybride + explications) pour une liste d'apprenants."""
    interactions = load_interactions(user_ids)
    profiles = load_profiles(user_ids)
    dismissed = load_dismissed(user_ids)
    matrix = user_matrix(interactions, user_ids, state.catalog)
    hybrid = state.hybrid()
    objects = []
    for row, user_id in enumerate(user_ids):
        vector = matrix[row]
        enrolled_ids = set(interactions.loc[interactions["user_id"] == user_id, "course_id"].tolist())
        exclude = {state.catalog.index[c] for c in enrolled_ids | dismissed.get(user_id, set()) if c in state.catalog.index}
        for rank, item in enumerate(hybrid.rank(vector, profiles.get(user_id), exclude), start=1):
            objects.append(
                Recommendation(
                    user_id=user_id,
                    course_id=state.catalog.courses[item.index].id,
                    score=round(item.score, 4),
                    collaborative=round(item.collaborative, 4),
                    content=round(item.content, 4),
                    profile=round(item.profile, 4),
                    reasons=item.reasons,
                    rank=rank,
                )
            )
    return objects


def write_recommendations(user_ids: list[int], objects: list[Recommendation]):
    with transaction.atomic():
        Recommendation.objects.filter(user_id__in=user_ids).delete()
        Recommendation.objects.bulk_create(objects, batch_size=2000)


def refresh_user_recommendations(user) -> None:
    """Recalcule les recommandations d'un apprenant (après le questionnaire, une inscription…)."""
    if getattr(user, "role", None) != "learner":
        return
    try:
        state = get_state()
        if state is None:
            return
        write_recommendations([user.id], compute_for_users(state, [user.id]))
    except Exception:  # les recommandations ne doivent jamais bloquer l'apprenant
        logger.exception("Impossible de recalculer les recommandations de %s", user.pk)


def ensure_recommendations(user):
    if user.role == "learner" and not Recommendation.objects.filter(user=user).exists():
        refresh_user_recommendations(user)


def match_scores_for_user(user) -> dict[int, float]:
    return {c: round(s, 3) for c, s in Recommendation.objects.filter(user=user).values_list("course_id", "score")}


def recommendation_payload(reco: Recommendation) -> dict:
    return {
        "score": round(reco.score, 3),
        "collaborative": round(reco.collaborative, 3),
        "content": round(reco.content, 3),
        "profile": round(reco.profile, 3),
        "reasons": reco.reasons,
        "rank": reco.rank,
    }


def recommendation_detail(user, course) -> dict | None:
    reco = Recommendation.objects.filter(user=user, course=course).first()
    return recommendation_payload(reco) if reco else None


TABS = {
    "for_you": "Pour toi",
    "because": "Parce que tu as suivi…",
    "collaborative": "Populaires chez les profils comme toi",
    "new": "Nouveautés",
}


def ranked_recommendations(user, tab: str = "for_you", limit: int = 10) -> dict:
    """Recommandations d'un onglet, déjà triées. Renvoie {tab, title, anchor, items: [Recommendation]}."""
    from apps.administration.services import get_platform_settings

    ensure_recommendations(user)
    qs = Recommendation.objects.filter(user=user, course__status=Course.Status.PUBLISHED).select_related("course")
    title, anchor = TABS.get(tab, TABS["for_you"]), None

    if tab == "because":
        last = (
            Enrollment.objects.filter(user=user).select_related("course").order_by("-enrolled_at").first()
        )
        if last is None:
            return {"tab": tab, "title": title, "anchor": None, "items": []}
        anchor = {"id": last.course.id, "slug": last.course.slug, "title": last.course.title}
        title = f"Parce que tu as suivi « {last.course.title} »"
        vectors = dict(CourseEmbedding.objects.values_list("course_id", "vector"))
        anchor_vec = np.array(vectors.get(last.course_id) or [])
        items = list(qs)
        if anchor_vec.size:
            def similarity(reco):
                vec = np.array(vectors.get(reco.course_id) or [])
                return float(vec @ anchor_vec) if vec.size == anchor_vec.size else -1.0

            items.sort(key=similarity, reverse=True)
        return {"tab": tab, "title": title, "anchor": anchor, "items": items[:limit]}

    if tab == "collaborative":
        items = list(qs.filter(collaborative__gt=0).order_by("-collaborative")[:limit])
        return {"tab": tab, "title": title, "anchor": None, "items": items}

    if tab == "new":
        since = timezone.now() - timedelta(days=90)
        items = list(qs.filter(course__published_at__gte=since).order_by("-course__published_at")[:limit])
        return {"tab": tab, "title": title, "anchor": None, "items": items}

    active = get_platform_settings().active_recommender
    order = {
        "collaborative": ["-collaborative", "rank"],
        "content": ["-content", "rank"],
        "popularity": ["rank"],
    }.get(active, ["rank"])
    if active == "popularity":
        popular = (
            Course.objects.filter(id__in=qs.values("course_id")).annotate(n=Count("enrollments")).order_by("-n", "id")
        )
        position = {course_id: i for i, course_id in enumerate(popular.values_list("id", flat=True))}
        items = sorted(qs, key=lambda r: position.get(r.course_id, 10_000))[:limit]
    else:
        items = list(qs.order_by(*order)[:limit])
    return {"tab": tab, "title": title, "anchor": None, "items": items}
