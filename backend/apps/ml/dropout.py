"""Détection du risque d'abandon.

On calcule pour chaque inscription des indicateurs de comportement à une date donnée
(jours sans activité, régularité, temps d'étude, vidéos terminées, quiz…), puis une
régression logistique apprend à reconnaître les apprenants qui finissent par décrocher.
La régression logistique est choisie car elle est explicable : chaque indicateur a une
contribution claire au score.
"""
from __future__ import annotations

from dataclasses import dataclass

import numpy as np
import pandas as pd
from sklearn.ensemble import GradientBoostingClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import confusion_matrix, f1_score, precision_score, recall_score, roc_auc_score
from sklearn.model_selection import GroupShuffleSplit
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

from .data import to_epoch

DAY = 86400.0
DROPOUT_INACTIVITY_DAYS = 21  # au-delà, une inscription non terminée est considérée comme abandonnée

# Variables utilisées par le modèle (choisies peu corrélées entre elles pour que
# le signe de chaque contribution reste facile à interpréter).
FEATURES = [
    "days_since_last_activity",
    "activity_trend",
    "minutes_14",
    "video_completion_rate",
    "quiz_avg_score",
    "quiz_trend",
    "progress",
    "weekly_pace",
]

FEATURE_LABELS = {
    "days_since_last_activity": "Jours sans activité",
    "active_days_14": "Jours actifs (14 derniers jours)",
    "avg_gap_days": "Écart moyen entre deux sessions",
    "activity_trend": "Évolution de l'activité",
    "minutes_14": "Temps d'étude (14 jours)",
    "video_completion_rate": "Vidéos regardées jusqu'au bout",
    "quiz_avg_score": "Score moyen aux quiz",
    "quiz_trend": "Évolution des scores aux quiz",
    "progress": "Progression dans le cours",
    "weekly_pace": "Rythme de progression",
}

TIME_EVENTS = {"video_progress", "lesson_time"}


def describe(feature: str, value: float, increases_risk: bool) -> str:
    """Phrase lisible pour un formateur."""
    if feature == "days_since_last_activity":
        days = int(round(value))
        return f"{days} jour{'s' if days > 1 else ''} sans connexion" if days >= 1 else "Actif aujourd'hui"
    if feature == "active_days_14":
        return f"{int(value)} jour{'s' if value >= 2 else ''} d'activité sur les 14 derniers"
    if feature == "avg_gap_days":
        return f"Sessions espacées de {value:.0f} jours en moyenne" if value >= 2 else "Sessions rapprochées (presque chaque jour)"
    if feature == "activity_trend":
        if value < 0:
            return "Sessions de plus en plus rares"
        return "Activité en hausse" if value > 0 else "Activité stable"
    if feature == "minutes_14":
        if increases_risk:
            return f"Peu de temps d'étude : {int(value)} min sur 14 jours"
        return f"{int(value)} min d'étude sur 14 jours"
    if feature == "video_completion_rate":
        if increases_risk:
            return f"Vidéos souvent arrêtées avant la fin ({int(round(value * 100))} % terminées)"
        return f"Vidéos regardées jusqu'au bout ({int(round(value * 100))} %)"
    if feature == "quiz_avg_score":
        return f"Score moyen aux quiz : {int(round(value))} %"
    if feature == "quiz_trend":
        if value < 0:
            return f"Scores aux quiz en baisse ({int(round(value))} pts)"
        return f"Scores aux quiz en hausse (+{int(round(value))} pts)" if value > 0 else "Scores aux quiz stables"
    if feature == "progress":
        return f"Progression de {int(round(value * 100))} % dans le cours"
    if feature == "weekly_pace":
        if increases_risk:
            return f"Rythme lent : {int(round(value * 100))} % du cours par semaine"
        return f"Bon rythme : {int(round(value * 100))} % du cours par semaine"
    return FEATURE_LABELS.get(feature, feature)


@dataclass
class GroupData:
    event_times: np.ndarray
    event_types: np.ndarray
    event_values: np.ndarray
    completion_times: np.ndarray
    quiz_times: np.ndarray
    quiz_scores: np.ndarray
    quiz_passed_times: np.ndarray
    total_items: int


class FeatureBuilder:
    """Calcule les indicateurs d'une inscription (user, cours) à une date de référence."""

    def __init__(self, frames: dict):
        self.frames = frames
        events = frames["events"].sort_values("created_at")
        events = events.drop_duplicates(subset=["user_id", "course_id", "event_type", "created_at"])
        self.duplicates_removed = len(frames["events"]) - len(events)
        self.groups: dict[tuple[int, int], GroupData] = {}
        ev_groups = {k: g for k, g in events.groupby(["user_id", "course_id"], sort=False)}
        comp_groups = {k: g for k, g in frames["completions"].groupby(["user_id", "course_id"], sort=False)}
        att_groups = {k: g for k, g in frames["attempts"].sort_values("submitted_at").groupby(["user_id", "course_id"], sort=False)}
        self._ev, self._comp, self._att = ev_groups, comp_groups, att_groups

    def group(self, user_id: int, course_id: int) -> GroupData:
        key = (user_id, course_id)
        if key in self.groups:
            return self.groups[key]
        ev = self._ev.get(key)
        comp = self._comp.get(key)
        att = self._att.get(key)
        empty = np.array([], dtype=float)
        if att is not None:
            passed = att[att["passed"]].drop_duplicates("quiz_id")
            quiz_passed_times = np.sort(to_epoch(passed["submitted_at"]))
        else:
            quiz_passed_times = empty
        data = GroupData(
            event_times=to_epoch(ev["created_at"]) if ev is not None else empty,
            event_types=ev["event_type"].to_numpy() if ev is not None else np.array([], dtype=object),
            event_values=ev["value"].fillna(0).to_numpy(dtype=float) if ev is not None else empty,
            completion_times=np.sort(to_epoch(comp["completed_at"])) if comp is not None else empty,
            quiz_times=to_epoch(att["submitted_at"]) if att is not None else empty,
            quiz_scores=att["score"].to_numpy(dtype=float) if att is not None else empty,
            quiz_passed_times=quiz_passed_times,
            total_items=self.frames["lesson_counts"].get(course_id, 0) + self.frames["quiz_counts"].get(course_id, 0),
        )
        self.groups[key] = data
        return data

    def features(self, user_id: int, course_id: int, enrolled_at: float, ref: float) -> dict[str, float]:
        g = self.group(user_id, course_id)
        mask = g.event_times <= ref
        times = g.event_times[mask]
        types = g.event_types[mask]
        values = g.event_values[mask]

        last = times.max() if times.size else enrolled_at
        days_since_last = max(0.0, (ref - last) / DAY)
        day_index = np.floor(times / DAY)
        ref_day = np.floor(ref / DAY)
        recent = day_index > ref_day - 14
        previous = (day_index <= ref_day - 14) & (day_index > ref_day - 28)
        active_14 = len(np.unique(day_index[recent]))
        # Écart moyen entre deux jours d'activité sur 4 semaines (hors pause en cours,
        # déjà mesurée par days_since_last_activity).
        window_days = np.unique(day_index[day_index > ref_day - 28])
        avg_gap = float(np.diff(window_days).mean()) if window_days.size >= 2 else 14.0
        active_prev = len(np.unique(day_index[previous]))
        minutes_14 = float(values[recent & np.isin(types, list(TIME_EVENTS))].sum() / 60.0)

        plays = int((types == "video_play").sum())
        completes = int((types == "video_complete").sum())
        video_completion = completes / plays if plays else 0.5

        quiz_mask = g.quiz_times <= ref
        scores = g.quiz_scores[quiz_mask]
        quiz_avg = float(scores.mean()) if scores.size else 65.0
        quiz_trend = float(scores[-1] - scores[0]) if scores.size >= 2 else 0.0

        done = int((g.completion_times <= ref).sum()) + int((g.quiz_passed_times <= ref).sum())
        progress = min(1.0, done / g.total_items) if g.total_items else 0.0
        days_enrolled = max(1.0, (ref - enrolled_at) / DAY)
        weekly_pace = progress / max(1.0, days_enrolled / 7.0)

        return {
            "days_since_last_activity": round(days_since_last, 2),
            "active_days_14": float(active_14),
            "avg_gap_days": round(avg_gap, 2),
            "activity_trend": float(active_14 - active_prev),
            "minutes_14": round(minutes_14, 1),
            "video_completion_rate": round(video_completion, 3),
            "quiz_avg_score": round(quiz_avg, 1),
            "quiz_trend": round(quiz_trend, 1),
            "progress": round(progress, 3),
            "weekly_pace": round(weekly_pace, 4),
            "quiz_count": int(scores.size),  # informatif, non utilisé par le modèle
        }


def build_training_set(builder: FeatureBuilder, now: float, seed: int = 42) -> pd.DataFrame:
    """Échantillons (indicateurs à une date passée, abandon final oui/non) pour l'apprentissage."""
    rng = np.random.default_rng(seed)
    enrollments = builder.frames["enrollments"]
    rows = []
    for e in enrollments.itertuples(index=False):
        enrolled = to_epoch(pd.Series([e.enrolled_at]))[0]
        last = to_epoch(pd.Series([e.last_activity_at]))[0] if pd.notna(e.last_activity_at) else enrolled
        start = enrolled + 3 * DAY
        if e.status == "completed" and pd.notna(e.completed_at):
            label, end = 0, to_epoch(pd.Series([e.completed_at]))[0] - DAY
            if end <= start:
                continue
            refs = rng.uniform(start, end, size=2)
        elif e.status == "active" and now - last > DROPOUT_INACTIVITY_DAYS * DAY:
            # Une date quelconque du parcours + une date pendant la phase de décrochage
            # (les derniers jours d'activité et les deux semaines qui suivent).
            label, end = 1, last + rng.uniform(3, 14) * DAY
            if end <= start:
                continue
            late_start = max(start, last - 10 * DAY)
            refs = [rng.uniform(start, end), rng.uniform(late_start, end)]
        else:
            continue  # inscription en cours : pas encore d'issue connue
        for ref in refs:
            features = builder.features(e.user_id, e.course_id, enrolled, ref)
            features.update({"label": label, "enrollment_id": e.id})
            rows.append(features)
    return pd.DataFrame(rows)


class DropoutModel:
    def __init__(self):
        self.pipeline = Pipeline(
            [
                ("scaler", StandardScaler()),
                ("clf", LogisticRegression(max_iter=2000, C=0.5)),
            ]
        )

    def fit(self, dataset: pd.DataFrame) -> dict:
        X = dataset[FEATURES].to_numpy(dtype=float)
        y = dataset["label"].to_numpy(dtype=int)
        groups = dataset["enrollment_id"].to_numpy()
        splitter = GroupShuffleSplit(n_splits=1, test_size=0.25, random_state=42)
        train_idx, test_idx = next(splitter.split(X, y, groups))

        self.pipeline.fit(X[train_idx], y[train_idx])
        proba = self.pipeline.predict_proba(X[test_idx])[:, 1]
        pred = (proba >= 0.5).astype(int)

        boosting = GradientBoostingClassifier(random_state=42).fit(X[train_idx], y[train_idx])
        boosting_auc = roc_auc_score(y[test_idx], boosting.predict_proba(X[test_idx])[:, 1])

        tn, fp, fn, tp = confusion_matrix(y[test_idx], pred, labels=[0, 1]).ravel()
        metrics = {
            "auc": round(float(roc_auc_score(y[test_idx], proba)), 4),
            "f1": round(float(f1_score(y[test_idx], pred)), 4),
            "precision": round(float(precision_score(y[test_idx], pred, zero_division=0)), 4),
            "recall": round(float(recall_score(y[test_idx], pred)), 4),
            "confusion_matrix": {"tn": int(tn), "fp": int(fp), "fn": int(fn), "tp": int(tp)},
            "gradient_boosting_auc": round(float(boosting_auc), 4),
            "n_train": int(len(train_idx)),
            "n_test": int(len(test_idx)),
            "dropout_rate": round(float(y.mean()), 3),
        }
        # Réentraînement final sur toutes les données.
        self.pipeline.fit(X, y)
        clf = self.pipeline.named_steps["clf"]
        metrics["coefficients"] = {f: round(float(c), 4) for f, c in zip(FEATURES, clf.coef_[0])}
        return metrics

    def predict(self, rows: list[dict]) -> np.ndarray:
        X = np.array([[row[f] for f in FEATURES] for row in rows], dtype=float)
        return self.pipeline.predict_proba(X)[:, 1]

    def explain(self, row: dict, top: int = 5) -> list[dict]:
        scaler = self.pipeline.named_steps["scaler"]
        clf = self.pipeline.named_steps["clf"]
        x = np.array([row[f] for f in FEATURES], dtype=float)
        z = (x - scaler.mean_) / np.where(scaler.scale_ == 0, 1, scaler.scale_)
        contributions = clf.coef_[0] * z
        total = np.abs(contributions).sum() or 1.0
        order = np.argsort(-np.abs(contributions))[:top]
        def text(i):
            if FEATURES[i] == "quiz_avg_score" and not row.get("quiz_count"):
                return "Aucun quiz passé pour l'instant"
            return describe(FEATURES[i], x[i], contributions[i] > 0)

        return [
            {
                "feature": FEATURES[i],
                "label": FEATURE_LABELS[FEATURES[i]],
                "text": text(i),
                "value": float(x[i]),
                "contribution": round(float(contributions[i]), 3),
                "share": round(float(contributions[i] / total), 3),
            }
            for i in order
        ]


def risk_level(score: float, high: float, medium: float) -> str:
    if score >= high:
        return "high"
    if score >= medium:
        return "medium"
    return "low"
