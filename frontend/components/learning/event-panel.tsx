"use client";

import { Activity } from "lucide-react";
import { useEffect, useState } from "react";

import { useApi } from "@/lib/hooks";
import { onTrack } from "@/lib/tracking";
import type { LearningEventItem } from "@/lib/types";

import { Card, CardBody } from "../ui/card";

interface Row {
  key: string;
  type: string;
  at: string;
  detail: string;
}

function detailFor(type: string, value: number | null | undefined, metadata?: Record<string, unknown>): string {
  if (type === "video_progress" && value) return `+${value} s`;
  if (type === "video_seek" && value) return `${value > 0 ? "+" : ""}${value} s`;
  if (type === "lesson_time" && value) return `${Math.round(value)} s`;
  if (metadata && typeof metadata.percent === "number") return `${metadata.percent} %`;
  return "";
}

/** Panneau de démonstration : montre en direct ce que la plateforme collecte pendant la leçon. */
export function EventPanel({ lessonId }: { lessonId: number }) {
  const { data } = useApi<LearningEventItem[]>(`/api/events/recent/?lesson=${lessonId}`);
  const [live, setLive] = useState<Row[]>([]);

  // Le parent donne key={lessonId} : la liste repart de zéro à chaque leçon.
  useEffect(() => {
    return onTrack((event) => {
      if (event.lesson !== lessonId) return;
      setLive((current) =>
        [{ key: `${event.at}-${event.event_type}`, type: event.event_type, at: event.at, detail: detailFor(event.event_type, event.value, event.metadata) }, ...current].slice(0, 10),
      );
    });
  }, [lessonId]);

  const history: Row[] = (data ?? []).map((e) => ({
    key: `db-${e.id}`,
    type: e.event_type,
    at: e.created_at,
    detail: detailFor(e.event_type, e.value, e.metadata),
  }));
  const rows = [...live, ...history].slice(0, 9);

  return (
    <Card>
      <CardBody className="p-5">
        <p className="flex items-center gap-2 font-bold">
          <Activity className="size-[18px] text-violet-600" /> Collecte des données
        </p>
        <p className="mt-1 text-[13px] text-muted">Ce que la plateforme enregistre pendant la leçon (mode démo).</p>
        <ul className="mt-3 space-y-1.5 font-mono text-xs">
          {rows.length === 0 && <li className="font-sans text-muted">Lance la vidéo pour voir les événements arriver.</li>}
          {rows.map((row) => (
            <li key={row.key} className="flex items-center justify-between gap-2">
              <span className="text-ink">{row.type}</span>
              <span className="text-muted">
                {new Date(row.at).toLocaleTimeString("fr-FR")}
                {row.detail && ` · ${row.detail}`}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-3 font-mono text-[11px] break-all text-violet-600">→ envoyé à l&apos;API Django : /api/events/</p>
      </CardBody>
    </Card>
  );
}
