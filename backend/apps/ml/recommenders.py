"""Systèmes de recommandation : popularité, filtrage collaboratif, embeddings de contenu, profil, hybride.

Toutes les classes travaillent sur la même indexation des cours (le `Catalog`).
"""
from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np
from sklearn.decomposition import PCA, TruncatedSVD
from sklearn.manifold import TSNE
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.preprocessing import normalize

from apps.core.choices import Level

from .data import Catalog, LearnerInfo

FRENCH_STOP_WORDS = [
    "a", "à", "au", "aux", "avec", "ce", "ces", "cette", "dans", "de", "des", "du", "elle", "en", "et", "eux",
    "il", "ils", "je", "la", "le", "les", "leur", "lui", "ma", "mais", "me", "même", "mes", "moi", "mon", "ne",
    "nos", "notre", "nous", "on", "ou", "par", "pas", "pour", "qu", "que", "qui", "sa", "se", "ses", "son",
    "sur", "ta", "te", "tes", "toi", "ton", "tu", "un", "une", "vos", "votre", "vous", "c", "d", "j", "l", "m",
    "n", "s", "t", "y", "est", "sont", "être", "avoir", "fait", "faire", "plus", "comme", "tout", "tous",
    "cours", "leçon", "module", "apprendre", "apprends", "découvrir", "comment", "bien", "entre",
]

# Affinité entre l'objectif déclaré et les catégories de cours.
GOAL_AFFINITY = {
    "data_analyst": {"data-science": 1.0, "bases-de-donnees": 0.9, "programmation": 0.6, "bureautique": 0.6,
                     "intelligence-artificielle": 0.5, "communication": 0.3},
    "developer": {"programmation": 1.0, "bases-de-donnees": 0.6, "intelligence-artificielle": 0.5, "data-science": 0.4},
    "ai": {"intelligence-artificielle": 1.0, "data-science": 0.8, "programmation": 0.7, "bases-de-donnees": 0.4},
    "career": {"gestion-de-projet": 1.0, "communication": 0.9, "bureautique": 0.9, "entrepreneuriat": 0.8,
               "data-science": 0.4},
}
GOAL_LABELS = {
    "data_analyst": "devenir data analyst",
    "developer": "apprendre à programmer",
    "ai": "te lancer dans l'IA",
    "career": "évoluer dans ton travail",
}
LEVEL_FIT = {
    Level.BEGINNER: {Level.BEGINNER: 1.0, Level.INTERMEDIATE: 0.45, Level.ADVANCED: 0.1},
    Level.INTERMEDIATE: {Level.BEGINNER: 0.55, Level.INTERMEDIATE: 1.0, Level.ADVANCED: 0.6},
    Level.ADVANCED: {Level.BEGINNER: 0.25, Level.INTERMEDIATE: 0.75, Level.ADVANCED: 1.0},
}
LEVEL_LABELS = dict(Level.choices)


def _safe_max_normalize(values: np.ndarray) -> np.ndarray:
    top = float(values.max()) if values.size else 0.0
    return values / top if top > 1e-9 else np.zeros_like(values)


# --- Popularité (modèle de référence) ----------------------------------------

class PopularityRecommender:
    def fit(self, matrix: np.ndarray):
        counts = (matrix > 0).sum(axis=0).astype(float)
        self.scores = _safe_max_normalize(counts)
        return self

    def score(self, user_vector: np.ndarray) -> np.ndarray:
        return self.scores.copy()


# --- Filtrage collaboratif (item-item) -----------------------------------------

class ItemCollaborativeRecommender:
    """« Les apprenants qui ont suivi les mêmes cours que toi ont aussi suivi… »

    Similarité cosinus entre les colonnes de la matrice apprenants × cours.
    """

    def fit(self, matrix: np.ndarray):
        binary = (matrix > 0).astype(float)
        columns = normalize(matrix, axis=0)
        self.similarity = columns.T @ columns
        np.fill_diagonal(self.similarity, 0.0)
        self.cooccurrence = binary.T @ binary
        self.item_counts = binary.sum(axis=0)
        return self

    def score(self, user_vector: np.ndarray) -> np.ndarray:
        total = user_vector.sum()
        if total <= 0:
            return np.zeros(self.similarity.shape[0])
        return (self.similarity @ user_vector) / total

    def explain(self, user_vector: np.ndarray, item: int, catalog: Catalog) -> str | None:
        contributions = self.similarity[item] * user_vector
        if contributions.max() <= 0:
            return None
        anchor = int(contributions.argmax())
        base = self.item_counts[item]
        if base <= 0:
            return None
        share = round(100 * self.cooccurrence[item, anchor] / base)
        if share < 15:
            return None
        return (
            f"{share} % des apprenants de ce cours ont aussi suivi « {catalog.courses[anchor].title} », comme toi."
        )


# --- Embeddings de contenu -------------------------------------------------------

class ContentRecommender:
    """Chaque cours devient un vecteur (TF-IDF puis SVD) : les cours proches traitent de sujets proches."""

    def fit(self, catalog: Catalog):
        texts = [c.text for c in catalog.courses]
        self.vectorizer = TfidfVectorizer(
            stop_words=FRENCH_STOP_WORDS, sublinear_tf=True, ngram_range=(1, 2), min_df=1, strip_accents=None
        )
        tfidf = self.vectorizer.fit_transform(texts)
        n_components = max(2, min(64, tfidf.shape[0] - 1, tfidf.shape[1] - 1))
        self.svd = TruncatedSVD(n_components=n_components, random_state=42)
        reduced = self.svd.fit_transform(tfidf)
        self.embeddings = normalize(reduced)
        self.similarity = self.embeddings @ self.embeddings.T
        np.fill_diagonal(self.similarity, 0.0)
        self.coords = self._project_2d(self.embeddings)
        return self

    @staticmethod
    def _project_2d(embeddings: np.ndarray) -> np.ndarray:
        """Projection 2D pour la carte des cours : t-SNE (distance cosinus), PCA en secours."""
        n = len(embeddings)
        if n <= 2:
            return np.full((n, 2), 0.5)
        try:
            coords = TSNE(
                n_components=2, perplexity=float(max(2, min(8, (n - 1) // 3))), metric="cosine",
                init="random", random_state=42, max_iter=1000,
            ).fit_transform(embeddings)
        except Exception:  # pragma: no cover - sécurité si t-SNE échoue
            coords = PCA(n_components=2, random_state=42).fit_transform(embeddings)
        span = coords.max(axis=0) - coords.min(axis=0)
        span[span == 0] = 1.0
        return (coords - coords.min(axis=0)) / span

    def embed_text(self, text: str) -> np.ndarray:
        vector = self.svd.transform(self.vectorizer.transform([text]))
        return normalize(vector)[0]

    def user_vector(self, interactions: np.ndarray, interests_text: str) -> np.ndarray:
        parts = []
        if interactions.sum() > 0:
            parts.append((0.75, normalize((interactions @ self.embeddings).reshape(1, -1))[0]))
        if interests_text.strip():
            parts.append((0.25 if parts else 1.0, self.embed_text(interests_text)))
        if not parts:
            return np.zeros(self.embeddings.shape[1])
        combined = sum(weight * vector for weight, vector in parts)
        return normalize(combined.reshape(1, -1))[0]

    def score(self, user_vec: np.ndarray) -> np.ndarray:
        if not np.any(user_vec):
            return np.zeros(self.embeddings.shape[0])
        return np.clip(self.embeddings @ user_vec, 0.0, 1.0)

    def explain(self, interactions: np.ndarray, item: int, catalog: Catalog) -> str | None:
        if interactions.sum() <= 0:
            return None
        sims = self.similarity[item] * (interactions > 0)
        if sims.max() <= 0.15:
            return None
        anchor = int(sims.argmax())
        shared = sorted(set(catalog.courses[item].tags) & set(catalog.courses[anchor].tags))
        detail = f" (thèmes communs : {', '.join(shared[:3])})" if shared else ""
        return f"Proche de « {catalog.courses[anchor].title} » que tu as suivi{detail}."


# --- Correspondance au profil (questionnaire) --------------------------------------

class ProfileScorer:
    """Score basé sur les réponses au questionnaire : centres d'intérêt, objectif et niveau."""

    def score(self, profile: LearnerInfo | None, catalog: Catalog) -> np.ndarray:
        scores = np.zeros(len(catalog.courses))
        if profile is None:
            return scores
        interests = {i.lower() for i in profile.interests}
        affinity = GOAL_AFFINITY.get(profile.goal, {})
        fit = LEVEL_FIT.get(profile.level, LEVEL_FIT[Level.BEGINNER])
        for i, course in enumerate(catalog.courses):
            tags = {t.lower() for t in course.tags}
            interest = min(1.0, len(tags & interests) / max(1, min(3, len(tags)))) if interests else 0.0
            goal = affinity.get(course.category_slug, 0.15) if profile.goal else 0.3
            level = fit.get(course.level, 0.5)
            scores[i] = 0.45 * interest + 0.35 * goal + 0.20 * level
        return scores

    def explain(self, profile: LearnerInfo | None, course) -> list[str]:
        if profile is None:
            return []
        reasons = []
        shared = [t for t in course.tags if t.lower() in {i.lower() for i in profile.interests}]
        if shared:
            reasons.append(f"Parle de sujets qui t'intéressent : {', '.join(shared[:3])}.")
        if GOAL_AFFINITY.get(profile.goal, {}).get(course.category_slug, 0) >= 0.8:
            reasons.append(f"Il correspond à ton objectif : {GOAL_LABELS.get(profile.goal, profile.goal)}.")
        if course.level == profile.level:
            reasons.append(f"Adapté à ton niveau ({LEVEL_LABELS.get(course.level, course.level).lower()}).")
        return reasons


# --- Modèle hybride ------------------------------------------------------------------

@dataclass
class HybridWeights:
    collaborative: float = 0.45
    content: float = 0.35
    profile: float = 0.20

    def adapted(self, n_interactions: int) -> tuple[float, float, float]:
        """Moins on connaît l'apprenant, plus on s'appuie sur son profil (démarrage à froid)."""
        confidence = min(1.0, n_interactions / 3.0)
        cf = self.collaborative * confidence
        content = self.content if n_interactions else self.content * 0.6
        profile = self.profile + (self.collaborative - cf) + (self.content - content)
        total = cf + content + profile
        return cf / total, content / total, profile / total


@dataclass
class ScoredItem:
    index: int
    score: float
    collaborative: float
    content: float
    profile: float
    reasons: list[str] = field(default_factory=list)


class HybridRecommender:
    """Combine les trois signaux. Chaque signal est d'abord ramené entre 0 et 1 pour l'apprenant."""

    def __init__(self, catalog: Catalog, collaborative: ItemCollaborativeRecommender, content: ContentRecommender,
                 profile_scorer: ProfileScorer, weights: HybridWeights | None = None):
        self.catalog = catalog
        self.collaborative = collaborative
        self.content = content
        self.profile_scorer = profile_scorer
        self.weights = weights or HybridWeights()

    def components(self, interactions: np.ndarray, profile: LearnerInfo | None):
        interests_text = " ".join((profile.interests if profile else []) * 2)
        if profile and profile.goal:
            interests_text += " " + GOAL_LABELS.get(profile.goal, "")
        cf = _safe_max_normalize(self.collaborative.score(interactions))
        ct = _safe_max_normalize(self.content.score(self.content.user_vector(interactions, interests_text)))
        pf = self.profile_scorer.score(profile, self.catalog)
        return cf, ct, pf

    def rank(self, interactions: np.ndarray, profile: LearnerInfo | None, exclude: set[int],
             explain: bool = True) -> list[ScoredItem]:
        cf, ct, pf = self.components(interactions, profile)
        w_cf, w_ct, w_pf = self.weights.adapted(int((interactions > 0).sum()))
        items = []
        for i in range(len(self.catalog.courses)):
            if i in exclude:
                continue
            contributions = (w_cf * cf[i], w_ct * ct[i], w_pf * pf[i])
            item = ScoredItem(i, float(sum(contributions)), *map(float, contributions))
            items.append(item)
        items.sort(key=lambda it: it.score, reverse=True)
        if explain:
            for item in items:
                item.reasons = self.explain(interactions, profile, item)
        return items

    def explain(self, interactions: np.ndarray, profile: LearnerInfo | None, item: ScoredItem) -> list[str]:
        reasons = []
        ordered = sorted(
            [("collaborative", item.collaborative), ("content", item.content), ("profile", item.profile)],
            key=lambda x: -x[1],
        )
        course = self.catalog.courses[item.index]
        for source, value in ordered:
            if value <= 0.02:
                continue
            if source == "collaborative":
                text = self.collaborative.explain(interactions, item.index, self.catalog)
                if text:
                    reasons.append({"source": "collaborative", "text": text})
            elif source == "content":
                text = self.content.explain(interactions, item.index, self.catalog)
                if text:
                    reasons.append({"source": "content", "text": text})
            else:
                for text in self.profile_scorer.explain(profile, course)[:2]:
                    reasons.append({"source": "profile", "text": text})
        if not reasons:
            reasons.append({"source": "popularity", "text": "Très suivi par les apprenants de la plateforme."})
        return reasons[:3]
