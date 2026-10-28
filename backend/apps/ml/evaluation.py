"""Évaluation hors ligne des recommandeurs (« leave-last-out »).

Pour chaque apprenant ayant suivi au moins 2 cours, on cache son inscription la plus
récente, on entraîne sur le reste, puis on regarde si le cours caché apparaît dans le
top K proposé. Les poids du modèle hybride sont réglés sur une moitié des apprenants
(validation) et les scores sont rapportés sur l'autre moitié (test).
"""
from __future__ import annotations

import math

import numpy as np
import pandas as pd

from .data import Catalog, LearnerInfo
from .recommenders import (
    ContentRecommender,
    HybridRecommender,
    HybridWeights,
    ItemCollaborativeRecommender,
    PopularityRecommender,
    ProfileScorer,
)

K = 5


def build_matrix(interactions: pd.DataFrame, user_ids: list[int], catalog: Catalog) -> np.ndarray:
    user_index = {u: i for i, u in enumerate(user_ids)}
    matrix = np.zeros((len(user_ids), len(catalog.courses)))
    for row in interactions.itertuples(index=False):
        ui, ci = user_index.get(row.user_id), catalog.index.get(row.course_id)
        if ui is not None and ci is not None:
            matrix[ui, ci] = max(matrix[ui, ci], row.weight)
    return matrix


def _metrics(ranked: list[int], target: int) -> tuple[float, float, float]:
    top = ranked[:K]
    if target in top:
        rank = top.index(target)
        return 1.0 / K, 1.0, 1.0 / math.log2(rank + 2)
    return 0.0, 0.0, 0.0


def _summarize(rows: list[tuple[float, float, float]]) -> dict:
    if not rows:
        return {"precision_at_k": 0.0, "recall_at_k": 0.0, "ndcg_at_k": 0.0, "k": K, "n_users": 0}
    arr = np.array(rows)
    return {
        "precision_at_k": round(float(arr[:, 0].mean()), 4),
        "recall_at_k": round(float(arr[:, 1].mean()), 4),
        "ndcg_at_k": round(float(arr[:, 2].mean()), 4),
        "k": K,
        "n_users": len(rows),
    }


def evaluate_recommenders(interactions: pd.DataFrame, catalog: Catalog, profiles: dict[int, LearnerInfo],
                          max_users: int = 600, seed: int = 42) -> dict:
    data = interactions[interactions["course_id"].isin(catalog.index)].copy()
    data = data.sort_values("enrolled_at")
    counts = data.groupby("user_id").size()
    eligible = counts[counts >= 2].index.tolist()
    rng = np.random.default_rng(seed)
    if len(eligible) > max_users:
        eligible = rng.choice(eligible, size=max_users, replace=False).tolist()
    if len(eligible) < 10:
        return {"error": "Pas assez d'apprenants avec au moins 2 cours pour évaluer."}

    # Cours caché = la dernière inscription de chaque apprenant évalué.
    held_out = data[data["user_id"].isin(eligible)].groupby("user_id").tail(1)
    held_pairs = set(zip(held_out["user_id"], held_out["course_id"]))
    train = data[[(u, c) not in held_pairs for u, c in zip(data["user_id"], data["course_id"])]]

    user_ids = sorted(data["user_id"].unique().tolist())
    user_index = {u: i for i, u in enumerate(user_ids)}
    matrix = build_matrix(train, user_ids, catalog)

    popularity = PopularityRecommender().fit(matrix)
    collaborative = ItemCollaborativeRecommender().fit(matrix)
    content = ContentRecommender().fit(catalog)
    profile_scorer = ProfileScorer()

    cases = []
    for row in held_out.itertuples(index=False):
        vector = matrix[user_index[row.user_id]]
        exclude = set(np.nonzero(vector)[0].tolist())
        cases.append((row.user_id, vector, exclude, catalog.index[row.course_id]))
    rng.shuffle(cases)
    split = len(cases) // 2
    validation, test = cases[:split], cases[split:]

    def run(score_fn, subset):
        rows = []
        for user_id, vector, exclude, target in subset:
            scores = score_fn(user_id, vector)
            ranked = [i for i in np.argsort(-scores, kind="stable") if i not in exclude]
            rows.append(_metrics(ranked, target))
        return _summarize(rows)

    # Les trois signaux ne dépendent pas des poids : on les calcule une seule fois par apprenant.
    base_model = HybridRecommender(catalog, collaborative, content, profile_scorer)
    components_cache = {
        user_id: base_model.components(vector, profiles.get(user_id)) for user_id, vector, _, _ in cases
    }

    def hybrid_fn(weights):
        def score(user_id, vector):
            cf, ct, pf = components_cache[user_id]
            w_cf, w_ct, w_pf = weights.adapted(int((vector > 0).sum()))
            return w_cf * cf + w_ct * ct + w_pf * pf

        return score

    # Réglage des poids du modèle hybride sur la moitié « validation ».
    best_weights, best_ndcg = HybridWeights(), -1.0
    for w_cf in np.arange(0.1, 0.85, 0.1):
        for w_ct in np.arange(0.1, 0.85, 0.1):
            w_pf = 1.0 - w_cf - w_ct
            if w_pf < 0.05:
                continue
            weights = HybridWeights(round(float(w_cf), 2), round(float(w_ct), 2), round(float(w_pf), 2))
            ndcg = run(hybrid_fn(weights), validation)["ndcg_at_k"]
            if ndcg > best_ndcg:
                best_ndcg, best_weights = ndcg, weights

    def content_fn(user_id, vector):
        profile = profiles.get(user_id)
        interests = " ".join(profile.interests) if profile else ""
        return content.score(content.user_vector(vector, interests))

    results = {
        "popularity": run(lambda u, v: popularity.score(v), test),
        "collaborative": run(lambda u, v: collaborative.score(v), test),
        "content": run(content_fn, test),
        "hybrid": run(hybrid_fn(best_weights), test),
    }
    results["weights"] = {
        "collaborative": best_weights.collaborative,
        "content": best_weights.content,
        "profile": best_weights.profile,
    }
    results["n_validation"] = len(validation)
    results["n_test"] = len(test)
    return results
