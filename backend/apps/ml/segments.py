"""Regroupement automatique des apprenants selon leur comportement (k-means)."""
from __future__ import annotations

import numpy as np
import pandas as pd
from sklearn.cluster import KMeans
from sklearn.preprocessing import StandardScaler

SEGMENT_DESCRIPTIONS = {
    "Réguliers": "Petites sessions presque chaque jour, bons résultats aux quiz.",
    "Week-end": "Longues sessions le samedi et le dimanche, peu d'activité en semaine.",
    "Pressés": "Avancent vite mais sautent souvent la fin des vidéos.",
    "Décrocheurs potentiels": "Sessions de plus en plus rares, vidéos arrêtées tôt.",
}

SEGMENT_FEATURES = ["active_days", "minutes_per_day", "weekend_share", "video_completion", "quiz_avg"]


def learner_behaviour(events: pd.DataFrame, attempts: pd.DataFrame, since: pd.Timestamp) -> pd.DataFrame:
    recent = events[events["created_at"] >= since].copy()
    if recent.empty:
        return pd.DataFrame(columns=["user_id", *SEGMENT_FEATURES])
    recent["day"] = recent["created_at"].dt.floor("D")
    recent["weekend"] = recent["created_at"].dt.dayofweek >= 5
    recent["seconds"] = np.where(recent["event_type"].isin(["video_progress", "lesson_time"]), recent["value"].fillna(0), 0)
    grouped = recent.groupby("user_id")
    frame = pd.DataFrame(
        {
            "active_days": grouped["day"].nunique(),
            "minutes": grouped["seconds"].sum() / 60.0,
            "weekend_share": grouped["weekend"].mean(),
            "plays": grouped["event_type"].apply(lambda s: (s == "video_play").sum()),
            "completes": grouped["event_type"].apply(lambda s: (s == "video_complete").sum()),
        }
    )
    frame["minutes_per_day"] = frame["minutes"] / frame["active_days"].clip(lower=1)
    frame["video_completion"] = np.where(frame["plays"] > 0, frame["completes"] / frame["plays"].clip(lower=1), 0.5)
    quiz = attempts[attempts["submitted_at"] >= since].groupby("user_id")["score"].mean()
    frame["quiz_avg"] = quiz.reindex(frame.index).fillna(quiz.mean() if len(quiz) else 65.0)
    return frame.reset_index()[["user_id", *SEGMENT_FEATURES]]


def cluster_learners(behaviour: pd.DataFrame, n_clusters: int = 4) -> tuple[pd.DataFrame, list[dict]]:
    if len(behaviour) < n_clusters * 3:
        return behaviour.assign(segment="Réguliers"), []
    X = StandardScaler().fit_transform(behaviour[SEGMENT_FEATURES].to_numpy(dtype=float))
    model = KMeans(n_clusters=n_clusters, n_init=10, random_state=42).fit(X)
    behaviour = behaviour.assign(cluster=model.labels_)
    centroids = behaviour.groupby("cluster")[SEGMENT_FEATURES].mean()

    # Attribution d'un nom lisible à chaque groupe, à partir de ses caractéristiques moyennes.
    names: dict[int, str] = {}
    remaining = list(centroids.index)
    weekend = centroids.loc[remaining, "weekend_share"].idxmax()
    names[weekend] = "Week-end"
    remaining.remove(weekend)
    dropout = centroids.loc[remaining, "active_days"].idxmin()
    names[dropout] = "Décrocheurs potentiels"
    remaining.remove(dropout)
    hurried = centroids.loc[remaining, "video_completion"].idxmin()
    names[hurried] = "Pressés"
    remaining.remove(hurried)
    for cluster in remaining:
        names[cluster] = "Réguliers"

    behaviour["segment"] = behaviour["cluster"].map(names)
    summary = []
    total = len(behaviour)
    for cluster, name in names.items():
        members = behaviour[behaviour["cluster"] == cluster]
        summary.append(
            {
                "name": name,
                "count": int(len(members)),
                "share": round(len(members) / total, 3),
                "description": SEGMENT_DESCRIPTIONS[name],
                "centroid": {f: round(float(centroids.loc[cluster, f]), 2) for f in SEGMENT_FEATURES},
            }
        )
    order = ["Réguliers", "Week-end", "Pressés", "Décrocheurs potentiels"]
    summary.sort(key=lambda s: order.index(s["name"]))
    return behaviour, summary
