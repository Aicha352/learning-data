"use client";

import { Heart, Info, ThumbsDown } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { CourseCard, CourseCardSkeleton } from "@/components/course/course-card";
import { CourseCover } from "@/components/course/course-visuals";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState, ErrorState, PageHeader, Progress, Tabs } from "@/components/ui/misc";
import { useToast } from "@/components/ui/toast";
import { api, ApiError } from "@/lib/api";
import { SOURCE_LABELS } from "@/lib/constants";
import { formatDecimal, formatDuration, formatPercent } from "@/lib/format";
import { useApi } from "@/lib/hooks";
import { track } from "@/lib/tracking";
import type { RecommendationsResponse } from "@/lib/types";

type Tab = "for_you" | "because" | "collaborative" | "new";

const TABS: { value: Tab; label: string }[] = [
  { value: "for_you", label: "Pour toi" },
  { value: "because", label: "Parce que tu as suivi…" },
  { value: "collaborative", label: "Populaires chez les profils comme toi" },
  { value: "new", label: "Nouveautés" },
];

const COMPONENTS = [
  { key: "collaborative", source: "Filtrage collaboratif", color: "#2D5BE3" },
  { key: "content", source: "Embeddings", color: "#7C3AED" },
  { key: "profile", source: "Questionnaire", color: "#F59E0B" },
] as const;

export default function RecommendationsPage() {
  const [tab, setTab] = useState<Tab>("for_you");
  const router = useRouter();
  const toast = useToast();
  const { data, error, isLoading, mutate } = useApi<RecommendationsResponse>(`/api/recommendations/?tab=${tab}&limit=10`, { keepPreviousData: true });
  const [dismissing, setDismissing] = useState<number | null>(null);

  const top = tab === "for_you" ? data?.results[0] : undefined;
  const others = tab === "for_you" ? data?.results.slice(1) : data?.results;

  async function dismiss(courseId: number) {
    setDismissing(courseId);
    try {
      const result = await api<{ detail: string }>(`/api/recommendations/${courseId}/dismiss/`, { method: "POST" });
      toast.info(result.detail);
      await mutate();
    } catch (err) {
      toast.error((err as ApiError).message);
    } finally {
      setDismissing(null);
    }
  }

  function open(courseId: number, slug: string) {
    track({ event_type: "recommendation_click", course: courseId, metadata: { tab } });
    void api(`/api/recommendations/${courseId}/click/`, { method: "POST" }).catch(() => undefined);
    router.push(`/cours/${slug}`);
  }

  return (
    <>
      <PageHeader title="Recommandations pour toi" subtitle="Mises à jour selon ton profil, ta progression et celle des apprenants qui te ressemblent." />
      <Tabs className="mb-6" tabs={TABS} value={tab} onChange={setTab} />

      {error ? (
        <ErrorState message={error.message} onRetry={() => mutate()} />
      ) : isLoading && !data ? (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <CourseCardSkeleton key={i} />
          ))}
        </div>
      ) : !data?.results.length ? (
        <EmptyState
          title={tab === "because" ? "Suis un premier cours pour voir cet onglet" : "Pas de recommandation ici pour le moment"}
          description="Les recommandations se mettent à jour à chaque cours suivi."
          action={
            <Button variant="secondary" onClick={() => router.push("/apprenant/catalogue")}>
              Explorer le catalogue
            </Button>
          }
        />
      ) : (
        <div className="space-y-8">
          {top && top.recommendation && (
            <Card className="grid grid-cols-1 gap-6 p-5 sm:p-6 lg:grid-cols-[260px_1fr]">
              <CourseCover color={top.cover_color} categorySlug={top.category.slug} accent={top.category.color} className="h-48 rounded-xl lg:h-full" iconSize={64} />
              <div className="min-w-0">
                <div className="flex flex-wrap gap-2">
                  <Badge tone="success">Meilleure correspondance · {formatPercent(top.recommendation.score)}</Badge>
                  <Badge tone="brand">{top.category.name}</Badge>
                </div>
                <h2 className="mt-3 text-2xl font-bold">{top.title}</h2>
                <p className="mt-2 text-[15px] text-muted">
                  {top.subtitle} · {top.level_label} · {formatDuration(top.duration_minutes)}
                </p>
                <ul className="mt-4 space-y-1.5">
                  {top.recommendation.reasons.map((reason) => (
                    <li key={reason.text} className="text-sm">
                      <span className="font-semibold text-brand-700">{SOURCE_LABELS[reason.source]} — </span>
                      {reason.text}
                    </li>
                  ))}
                </ul>
                <p className="mt-5 text-sm font-semibold">Comment ce score a été calculé</p>
                <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
                  <div className="space-y-3">
                    {COMPONENTS.map((component) => {
                      const value = top.recommendation![component.key];
                      return (
                        <div key={component.key}>
                          <div className="mb-1 flex justify-between gap-2 text-[13px]">
                            <span className="font-medium">{SOURCE_LABELS[component.key]}</span>
                            <span className="text-muted">
                              {component.source} · <span className="font-semibold text-ink">{formatDecimal(value)}</span>
                            </span>
                          </div>
                          <Progress value={value} tone={component.color} size="sm" />
                        </div>
                      );
                    })}
                  </div>
                  <div className="rounded-xl bg-success-50 px-5 py-3 text-success-600">
                    <p className="text-[13px] font-medium">Score hybride final</p>
                    <p className="text-2xl font-bold">{formatDecimal(top.recommendation.score)} / 1</p>
                  </div>
                </div>
                <div className="mt-6 flex flex-wrap gap-3">
                  <Button onClick={() => open(top.id, top.slug)}>Découvrir ce cours</Button>
                  <Button variant="secondary" icon={<ThumbsDown className="size-4" />} loading={dismissing === top.id} onClick={() => dismiss(top.id)}>
                    Pas intéressé
                  </Button>
                </div>
              </div>
            </Card>
          )}

          {data.title && tab !== "for_you" && <h2 className="text-xl font-bold">{data.title}</h2>}
          {tab === "for_you" && others && others.length > 0 && <h2 className="text-xl font-bold">Autres cours pour toi</h2>}

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {others?.map((course) => (
              <CourseCard
                key={course.id}
                course={course}
                onClick={() => track({ event_type: "recommendation_click", course: course.id, metadata: { tab } })}
                footer={
                  <div className="flex items-center justify-between gap-2">
                    <p className="line-clamp-1 text-xs text-muted" title={course.recommendation?.reasons[0]?.text}>
                      {course.recommendation?.reasons[0]?.text}
                    </p>
                    <button
                      onClick={() => dismiss(course.id)}
                      disabled={dismissing === course.id}
                      className="shrink-0 rounded-lg p-1.5 text-muted hover:bg-slate-100 hover:text-danger-600 disabled:opacity-50"
                      aria-label={`Pas intéressé par ${course.title}`}
                      title="Pas intéressé"
                    >
                      <ThumbsDown className="size-4" />
                    </button>
                  </div>
                }
              />
            ))}
          </div>

          <Card className="flex items-start gap-3 bg-brand-50 p-4 text-sm text-brand-800">
            <Heart className="mt-0.5 size-4 shrink-0" />
            <p>
              Une recommandation ne te plaît pas ? Clique sur « Pas intéressé » : ton avis est enregistré et améliore les prochaines suggestions.{" "}
              <Link href="/apprenant/profil" className="font-semibold underline">
                Modifier mes centres d&apos;intérêt
              </Link>
            </p>
          </Card>
          <p className="flex items-center gap-1.5 text-xs text-muted">
            <Info className="size-3.5" /> Les recommandations combinent trois signaux : les apprenants qui te ressemblent, la proximité avec tes cours et ton questionnaire.
          </p>
        </div>
      )}
    </>
  );
}
