"use client";

import { Award, PlayCircle } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { CourseCover } from "@/components/course/course-visuals";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState, ErrorState, PageHeader, Progress, Skeleton, Tabs } from "@/components/ui/misc";
import { RISK } from "@/lib/constants";
import { formatPercent, timeAgo } from "@/lib/format";
import { useApi } from "@/lib/hooks";
import { stepHref } from "@/lib/routes";
import type { EnrollmentItem } from "@/lib/types";

type Filter = "all" | "active" | "completed";

export default function MyCoursesPage() {
  const [filter, setFilter] = useState<Filter>("all");
  const { data, error, isLoading, mutate } = useApi<EnrollmentItem[]>("/api/learn/enrollments/");
  const items = (data ?? []).filter((item) => filter === "all" || item.status === filter);
  const counts = {
    all: data?.length ?? 0,
    active: data?.filter((i) => i.status === "active").length ?? 0,
    completed: data?.filter((i) => i.status === "completed").length ?? 0,
  };

  return (
    <>
      <PageHeader title="Mes cours" subtitle="Tous les cours auxquels tu es inscrit." actions={<LinkButton href="/apprenant/catalogue" variant="secondary">Explorer le catalogue</LinkButton>} />
      <Tabs
        className="mb-6"
        value={filter}
        onChange={setFilter}
        tabs={[
          { value: "all", label: `Tous (${counts.all})` },
          { value: "active", label: `En cours (${counts.active})` },
          { value: "completed", label: `Terminés (${counts.completed})` },
        ]}
      />
      {error ? (
        <ErrorState message={error.message} onRetry={() => mutate()} />
      ) : isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          title={filter === "completed" ? "Aucun cours terminé pour l'instant" : "Aucun cours ici"}
          description="Inscris-toi à un cours depuis le catalogue ou tes recommandations."
          action={<LinkButton href="/apprenant/recommandations">Voir mes recommandations</LinkButton>}
        />
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <Card key={item.id} className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:p-5">
              <CourseCover color={item.course.cover_color} categorySlug={item.course.category.slug} accent={item.course.category.color} className="h-24 shrink-0 rounded-xl sm:w-36" iconSize={30} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="brand">{item.course.category.name}</Badge>
                  {item.status === "completed" ? <Badge tone="success">Terminé</Badge> : item.risk_level && item.risk_level !== "low" && <Badge tone={RISK[item.risk_level].tone}>Rythme à reprendre</Badge>}
                </div>
                <Link href={`/apprenant/apprendre/${item.course.slug}`} className="mt-1.5 block truncate text-lg font-semibold hover:text-brand-700">
                  {item.course.title}
                </Link>
                <p className="text-[13px] text-muted">
                  {item.next ? `Prochaine étape : ${item.next.title}` : item.status === "completed" ? "Bravo, cours terminé !" : "Toutes les étapes sont faites"} · Dernière activité : {timeAgo(item.last_activity_at)}
                </p>
                <div className="mt-3 flex items-center gap-3">
                  <Progress value={item.progress} tone={item.status === "completed" ? "success" : "brand"} className="max-w-sm" />
                  <span className="text-sm font-semibold">{formatPercent(item.progress)}</span>
                </div>
              </div>
              <div className="flex shrink-0 gap-2 sm:flex-col">
                {item.status === "completed" ? (
                  <>
                    <LinkButton href={`/apprenant/certificats/${item.course.slug}`} icon={<Award className="size-4" />}>
                      Certificat
                    </LinkButton>
                    <LinkButton href={`/apprenant/apprendre/${item.course.slug}`} variant="secondary">
                      Revoir
                    </LinkButton>
                  </>
                ) : (
                  <LinkButton href={stepHref(item.course.slug, item.next)} icon={<PlayCircle className="size-4" />}>
                    Continuer
                  </LinkButton>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
