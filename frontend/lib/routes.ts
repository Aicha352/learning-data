import type { NextStep } from "./types";

/** Lien vers la prochaine étape d'un cours (leçon ou quiz). */
export function stepHref(courseSlug: string, step: NextStep | null | undefined): string {
  if (!step) return `/apprenant/apprendre/${courseSlug}`;
  return step.type === "quiz"
    ? `/apprenant/apprendre/${courseSlug}/quiz/${step.id}`
    : `/apprenant/apprendre/${courseSlug}/lecon/${step.id}`;
}
