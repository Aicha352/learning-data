import type { Level, RiskLevel, Role } from "./types";

export const APP_NAME = "Learning Data";

export const LEVELS: { value: Level; label: string }[] = [
  { value: "beginner", label: "Débutant" },
  { value: "intermediate", label: "Intermédiaire" },
  { value: "advanced", label: "Avancé" },
];

export const GOALS = [
  { value: "data_analyst", label: "Devenir data analyst", description: "Analyser des données pour aider à décider" },
  { value: "developer", label: "Apprendre à programmer", description: "Des bases solides en Python et en web" },
  { value: "ai", label: "Me lancer dans l'IA", description: "Machine learning et intelligence artificielle" },
  { value: "career", label: "Évoluer dans mon travail", description: "Compétences utiles au quotidien" },
];

export const WEEKLY_HOURS = [
  { value: "1-2", label: "1 à 2 h" },
  { value: "3-5", label: "3 à 5 h" },
  { value: "6-10", label: "6 à 10 h" },
  { value: "10+", label: "Plus de 10 h" },
];

export const DURATIONS = [
  { value: "short", label: "Moins de 5 h" },
  { value: "medium", label: "5 à 10 h" },
  { value: "long", label: "Plus de 10 h" },
];

export const SORTS = [
  { value: "recommended", label: "Recommandés pour moi", learnerOnly: true },
  { value: "popular", label: "Les plus suivis" },
  { value: "rating", label: "Les mieux notés" },
  { value: "newest", label: "Les plus récents" },
  { value: "title", label: "Ordre alphabétique" },
];

export const RISK: Record<RiskLevel, { label: string; tone: "danger" | "warning" | "success" }> = {
  high: { label: "Élevé", tone: "danger" },
  medium: { label: "Moyen", tone: "warning" },
  low: { label: "Faible", tone: "success" },
};

export const ROLE_HOME: Record<Role, string> = {
  learner: "/apprenant",
  instructor: "/formateur",
  admin: "/admin",
};

export const COURSE_STATUS_TONE: Record<string, "success" | "warning" | "neutral" | "danger" | "brand"> = {
  published: "success",
  pending: "warning",
  draft: "neutral",
  changes_requested: "brand",
  rejected: "danger",
};

export const COVER_COLORS = ["#EAF0FF", "#F3E8FF", "#FFF4DE", "#E7F6EC", "#E0F2FE", "#FCE7F3", "#CCFBF1", "#FEF3C7", "#FDECEC"];

export const SOURCE_LABELS: Record<string, string> = {
  collaborative: "Apprenants similaires",
  content: "Proximité avec tes cours",
  profile: "Correspondance au profil",
  popularity: "Popularité",
};
