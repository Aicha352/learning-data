import { CircleAlert, CircleCheck, TriangleAlert } from "lucide-react";

import { RISK } from "@/lib/constants";
import { formatPercent } from "@/lib/format";
import type { RiskLevel } from "@/lib/types";

import { Badge } from "./badge";

export const RISK_COLORS: Record<RiskLevel, string> = { low: "#16A34A", medium: "#F59E0B", high: "#DC2626" };

const ICONS = {
  high: <TriangleAlert className="size-3.5" />,
  medium: <CircleAlert className="size-3.5" />,
  low: <CircleCheck className="size-3.5" />,
};

/** Badge de risque : icône + libellé (+ score), jamais la couleur seule. */
export function RiskBadge({ level, score }: { level: RiskLevel; score?: number }) {
  const info = RISK[level];
  return (
    <Badge tone={info.tone} icon={ICONS[level]}>
      {score !== undefined ? `${formatPercent(score)} · ` : ""}
      {info.label}
    </Badge>
  );
}
