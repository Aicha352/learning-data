"use client";

import { useState } from "react";

import { Funnel, SimpleBarChart } from "@/components/charts/charts";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Select } from "@/components/ui/form";
import { EmptyState, ErrorState, PageHeader, Progress, Skeleton, Table, TD, TH } from "@/components/ui/misc";
import { RISK_COLORS, RiskBadge } from "@/components/ui/risk";
import { withQuery } from "@/lib/api";
import { formatNumber, formatPercent, formatScore } from "@/lib/format";
import { useApi } from "@/lib/hooks";
import type { CourseAnalytics } from "@/lib/types";

const PERIODS = [
  { value: "30d", label: "30 derniers jours" },
  { value: "90d", label: "3 derniers mois" },
  { value: "365d", label: "12 derniers mois" },
  { value: "all", label: "Depuis le début" },
];

const STATUS_TONE = { rework: "danger", watch: "warning", ok: "success" } as const;

export default function AnalyticsPage() {
  const [course, setCourse] = useState("");
  const [period, setPeriod] = useState("90d");
  const { data, error, isLoading, mutate } = useApi<CourseAnalytics>(withQuery("/api/instructor/analytics/", { course, period }), { keepPreviousData: true });

  const funnelHighlight = (() => {
    if (!data?.funnel) return undefined;
    let worst: { drop: number; label: string } | undefined;
    data.funnel.forEach((step, i) => {
      if (i === 0) return;
      const prev = data.funnel![i - 1].value;
      const drop = prev ? (prev - step.value) / prev : 0;
      if (!worst || drop > worst.drop) worst = { drop, label: step.label };
    });
    return worst?.label;
  })();
  const peak = data?.dropoff ? data.dropoff.reduce((best, d, i, arr) => (d.value > arr[best].value ? i : best), 0) : undefined;

  return (
    <>
      <PageHeader
        title="Learning analytics"
        subtitle="Comprendre comment les apprenants avancent… et où ils s'arrêtent."
        actions={
          <>
            <Select
              aria-label="Cours"
              containerClassName="w-full sm:w-72"
              value={course || String(data?.course?.id ?? "")}
              onChange={(e) => setCourse(e.target.value)}
              options={(data?.courses ?? []).map((c) => ({ value: c.id, label: `${c.title} (${c.enrolled})` }))}
            />
            <Select aria-label="Période" containerClassName="w-full sm:w-52" value={period} onChange={(e) => setPeriod(e.target.value)} options={PERIODS} />
          </>
        }
      />

      {error ? (
        <ErrorState message={error.message} onRetry={() => mutate()} />
      ) : isLoading && !data ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Skeleton className="h-80 rounded-2xl" />
          <Skeleton className="h-80 rounded-2xl" />
        </div>
      ) : !data?.course ? (
        <EmptyState title="Aucun cours publié" description="Les analyses apparaîtront dès que tu auras un cours publié avec des apprenants." />
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card>
              <CardBody>
                <CardHeader title="Entonnoir de complétion" subtitle={`Apprenants inscrits sur la période · ${data.course.title}`} />
                <div className="mt-5">{data.funnel && data.funnel[0].value > 0 ? <Funnel steps={data.funnel} highlightLabel={funnelHighlight} /> : <p className="text-sm text-muted">Aucun inscrit sur cette période.</p>}</div>
                {data.funnel_note && data.funnel && data.funnel[0].value > 0 && <p className="mt-5 rounded-xl bg-danger-50 p-3.5 text-sm font-medium text-danger-600">{data.funnel_note}</p>}
              </CardBody>
            </Card>
            <Card>
              <CardBody>
                <CardHeader title="Quand les apprenants abandonnent" subtitle="Semaine de la dernière activité, depuis l'inscription" />
                <div className="mt-5">
                  <SimpleBarChart data={data.dropoff ?? []} highlight={peak} danger valueLabel="Abandons" />
                </div>
                {data.dropoff_note && <p className="mt-3 text-[13px] text-muted">{data.dropoff_note} Les alertes de risque sont envoyées dès la première semaine.</p>}
              </CardBody>
            </Card>
          </div>

          <Card>
            <CardBody>
              <CardHeader title="Profils d'apprenants" subtitle="Groupes trouvés automatiquement (k-means) à partir du comportement" />
              <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {(data.segments ?? []).map((segment) => (
                  <div key={segment.name} className="rounded-xl border border-line p-4">
                    <p className="flex items-center gap-2 font-semibold">
                      <span className="size-3 rounded-full" style={{ backgroundColor: RISK_COLORS[segment.risk_level] }} />
                      {segment.name}
                    </p>
                    <p className="mt-2 text-[26px] font-bold">{formatPercent(segment.share)}</p>
                    <p className="text-xs text-muted">{formatNumber(segment.count)} apprenants</p>
                    <p className="mt-2 text-[13px] leading-relaxed text-muted">{segment.description}</p>
                    <div className="mt-3">
                      <RiskBadge level={segment.risk_level} />
                    </div>
                  </div>
                ))}
              </div>
            </CardBody>
          </Card>

          <div>
            <h2 className="mb-3 text-lg font-bold">Leçons à surveiller</h2>
            {!data.lessons?.length ? (
              <EmptyState title="Pas assez de données" description="Les leçons apparaîtront quand des apprenants les auront ouvertes." />
            ) : (
              <Table>
                <thead>
                  <tr>
                    <TH>Leçon</TH>
                    <TH>Module</TH>
                    <TH>Apprenants</TH>
                    <TH>Taux de sortie</TH>
                    <TH>Retours en arrière</TH>
                    <TH>Note au quiz</TH>
                    <TH>Statut</TH>
                  </tr>
                </thead>
                <tbody>
                  {data.lessons.map((lesson) => (
                    <tr key={lesson.id}>
                      <TD className="font-medium">{lesson.title}</TD>
                      <TD className="whitespace-nowrap text-muted">{lesson.module}</TD>
                      <TD>{formatNumber(lesson.viewers)}</TD>
                      <TD>
                        <div className="flex w-32 items-center gap-2">
                          <Progress value={Math.min(1, lesson.exit_rate * 3)} size="sm" tone={STATUS_TONE[lesson.status]} label={`Taux de sortie ${formatPercent(lesson.exit_rate)}`} />
                          <span className="w-10 text-xs">{formatPercent(lesson.exit_rate)}</span>
                        </div>
                      </TD>
                      <TD>{formatNumber(lesson.replays, 1)} par apprenant</TD>
                      <TD>{formatScore(lesson.quiz_avg)}</TD>
                      <TD>
                        <Badge tone={STATUS_TONE[lesson.status]}>{lesson.status_label}</Badge>
                      </TD>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
            <p className="mt-2 text-xs text-muted">Taux de sortie : part des apprenants inactifs depuis 14 jours dont c&apos;est la dernière leçon ouverte.</p>
          </div>
        </div>
      )}
    </>
  );
}
