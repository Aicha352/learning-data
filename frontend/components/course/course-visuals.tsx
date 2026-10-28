import {
  BarChart3,
  BookOpen,
  BrainCircuit,
  CodeXml,
  Database,
  FileSpreadsheet,
  MessagesSquare,
  Rocket,
  SquareKanban,
  Star,
  type LucideIcon,
} from "lucide-react";
import { createElement } from "react";

import { cn } from "@/lib/cn";
import { formatNumber, formatPercent } from "@/lib/format";
import type { Level } from "@/lib/types";

import { Badge } from "../ui/badge";

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  "data-science": BarChart3,
  programmation: CodeXml,
  "intelligence-artificielle": BrainCircuit,
  "bases-de-donnees": Database,
  "gestion-de-projet": SquareKanban,
  bureautique: FileSpreadsheet,
  communication: MessagesSquare,
  entrepreneuriat: Rocket,
};

export function categoryIcon(slug?: string): LucideIcon {
  return (slug && CATEGORY_ICONS[slug]) || BookOpen;
}

/** Illustration d'un cours : couleur de fond + icône de la catégorie. */
export function CourseCover({
  color,
  categorySlug,
  accent = "#2D5BE3",
  className,
  iconSize = 40,
}: {
  color: string;
  categorySlug?: string;
  accent?: string;
  className?: string;
  iconSize?: number;
}) {
  const icon = createElement(categoryIcon(categorySlug), { style: { color: accent, width: iconSize, height: iconSize }, strokeWidth: 1.6 });
  return (
    <div className={cn("relative flex items-center justify-center overflow-hidden", className)} style={{ backgroundColor: color }} aria-hidden="true">
      <div className="absolute -top-8 -right-8 size-28 rounded-full opacity-[0.12]" style={{ backgroundColor: accent }} />
      <div className="absolute -bottom-10 -left-6 size-24 rounded-full opacity-[0.08]" style={{ backgroundColor: accent }} />
      {icon}
    </div>
  );
}

export function Rating({ value, count, className }: { value: number | null; count?: number; className?: string }) {
  if (value === null || value === undefined) {
    return <span className={cn("text-[13px] text-muted", className)}>Pas encore d&apos;avis</span>;
  }
  return (
    <span className={cn("inline-flex items-center gap-1 text-[13px] font-medium text-muted", className)}>
      <Star className="size-3.5 fill-warning-500 text-warning-500" aria-hidden="true" />
      <span className="text-ink">{formatNumber(value, 1)}</span>
      {count !== undefined && <span>({formatNumber(count)})</span>}
      <span className="sr-only">sur 5</span>
    </span>
  );
}

export function StarInput({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  return (
    <div className="flex gap-1" role="radiogroup" aria-label="Note">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={`${n} étoile${n > 1 ? "s" : ""}`}
          onClick={() => onChange(n)}
          className="rounded p-0.5 transition-transform hover:scale-110"
        >
          <Star className={cn("size-7", n <= value ? "fill-warning-500 text-warning-500" : "text-slate-300")} />
        </button>
      ))}
    </div>
  );
}

export function MatchBadge({ score, className }: { score: number | null | undefined; className?: string }) {
  if (score === null || score === undefined) return null;
  return (
    <Badge tone="success" className={className}>
      Pour toi · {formatPercent(score)}
    </Badge>
  );
}

const LEVEL_TONES: Record<Level, "success" | "brand" | "violet"> = {
  beginner: "success",
  intermediate: "brand",
  advanced: "violet",
};

export function LevelBadge({ level, label }: { level: Level; label: string }) {
  return <Badge tone={LEVEL_TONES[level] ?? "neutral"}>{label}</Badge>;
}
