"use client";

import { CircleCheck, Star, TriangleAlert, Users } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { StackedBar, TrendChart } from "@/components/charts/charts";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Select } from "@/components/ui/form";
import { Avatar, EmptyState, ErrorState, PageHeader, Progress, Skeleton, StatCard } from "@/components/ui/misc";
import { RISK_COLORS, RiskBadge } from "@/components/ui/risk";
import { useAuth } from "@/lib/auth";
import { formatNumber, formatPercent, formatScore, signed } from "@/lib/format";
import { useApi } from "@/lib/hooks";
import type { InstructorOverview } from "@/lib/types";

const PERIODS = [
  { value: "7d", label: "7 derniers jours" },
  { value: "30d", label: "30 derniers jours" },
  { value: "90d", label: "90 derniers jours" },
];

export default function InstructorOverviewPage() {
  const { user } = useAuth();
  const [period, setPeriod] = useState("7d");
  const { data, error, isLoading, mutate } = useApi<InstructorOverview>(`/api/instructor/overview/?period=${period}`, { keepPreviousData: true });

  return (
    <>
      <PageHeader
        title="Vue d'ensemble"
        subtitle={user?.role === "admin" ? "Tous les cours de la plateforme" : "Tes cours publiés et tes apprenants"}
        actions={<Select aria-label="Période" value={period} onChange={(e) => setPeriod(e.target.value)} options={PERIODS} containerClassName="w-52" />}
      />
      {error ? (
        <ErrorState message={error.message} onRetry={() => mutate()} />
      ) : isLoading || !data ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-36 rounded-2xl" />
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              icon={<Users className="size-5" />}
              label="Apprenants actifs"
              value={formatNumber(data.kpis.active_learners)}
              delta={data.kpis.active_learners_delta !== null ? signed(data.kpis.active_learners_delta, " %") : undefined}
              deltaTone={(data.kpis.active_learners_delta ?? 0) >= 0 ? "success" : "danger"}
            />
            <StatCard
              icon={<CircleCheck className="size-5" />}
              tone="success"
              label="Taux de complétion"
              value={formatPercent(data.kpis.completion_rate)}
              delta={data.kpis.completion_delta_pts !== null ? signed(data.kpis.completion_delta_pts, " pts") : undefined}
              deltaTone={(data.kpis.completion_delta_pts ?? 0) >= 0 ? "success" : "danger"}
            />
            <StatCard
              icon={<TriangleAlert className="size-5" />}
              tone="danger"
              label="Apprenants à risque élevé"
              value={formatNumber(data.kpis.high_risk)}
              delta={data.kpis.high_risk_delta ? signed(data.kpis.high_risk_delta) : undefined}
              deltaTone={data.kpis.high_risk_delta > 0 ? "danger" : "success"}
            />
            <StatCard
              icon={<Star className="size-5" />}
              tone="warning"
              label="Score moyen aux quiz"
              value={formatScore(data.kpis.avg_quiz_score)}
              delta={data.kpis.avg_quiz_delta_pts !== null ? signed(data.kpis.avg_quiz_delta_pts, " pt") : undefined}
              deltaTone={(data.kpis.avg_quiz_delta_pts ?? 0) >= 0 ? "success" : "danger"}
            />
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
            <Card>
              <CardBody>
                <CardHeader title="Apprenants actifs par jour" subtitle="30 derniers jours" />
                <div className="mt-5">
                  <TrendChart
                    data={data.daily_sessions.map((d) => ({
                      label: new Date(d.date).toLocaleDateString("fr-FR", { day: "numeric", month: "short" }),
                      value: d.sessions,
                    }))}
                    valueLabel="Apprenants actifs"
                    height={240}
                  />
                </div>
              </CardBody>
            </Card>
            <Card>
              <CardBody>
                <CardHeader title="Répartition du risque de décrochage" subtitle="Prédit chaque nuit par le modèle de détection d'abandon" />
                <StackedBar
                  className="mt-5"
                  segments={[
                    { label: "Risque faible", value: data.risk_distribution.low, color: RISK_COLORS.low },
                    { label: "Risque moyen", value: data.risk_distribution.medium, color: RISK_COLORS.medium },
                    { label: "Risque élevé", value: data.risk_distribution.high, color: RISK_COLORS.high },
                  ]}
                />
                {data.risk_note && data.risk_distribution.high > 0 && (
                  <p className="mt-5 rounded-xl bg-danger-50 p-3.5 text-sm text-danger-600">
                    <span className="font-semibold">{data.risk_distribution.high} apprenants à risque élevé.</span> {data.risk_note}
                  </p>
                )}
              </CardBody>
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
            <Card>
              <CardBody>
                <CardHeader
                  title="Alertes récentes"
                  action={
                    <Link href="/formateur/risques" className="text-sm font-semibold text-brand-600 hover:underline">
                      Tous les apprenants à risque →
                    </Link>
                  }
                />
                {data.alerts.length === 0 ? (
                  <EmptyState title="Aucune alerte" description="Aucun apprenant n'est en risque élevé pour le moment." className="mt-4 py-8" />
                ) : (
                  <ul className="mt-3 divide-y divide-line">
                    {data.alerts.map((alert) => (
                      <li key={`${alert.user.id}-${alert.course.id}`}>
                        <Link href={`/formateur/apprenants/${alert.user.id}`} className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-3 hover:bg-slate-50">
                          <Avatar initials={alert.user.initials} color={alert.user.color} size={38} />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold">{alert.user.name}</p>
                            <p className="truncate text-xs text-muted">
                              {alert.course.title} · {alert.signal}
                            </p>
                          </div>
                          <RiskBadge level={alert.level} score={alert.score} />
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </CardBody>
            </Card>
            <Card>
              <CardBody>
                <CardHeader title="Cours les plus suivis" subtitle="Taux de complétion" />
                <ul className="mt-5 space-y-4">
                  {data.top_courses.map((course) => (
                    <li key={course.id}>
                      <div className="mb-1.5 flex justify-between gap-3 text-sm">
                        <Link href={`/cours/${course.slug}`} className="truncate font-medium hover:text-brand-700">
                          {course.title}
                        </Link>
                        <span className="shrink-0 text-muted">{formatNumber(course.enrolled)} inscrits</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <Progress value={course.completion_rate} size="sm" />
                        <span className="w-10 text-right text-xs font-semibold">{formatPercent(course.completion_rate)}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              </CardBody>
            </Card>
          </div>
        </div>
      )}
    </>
  );
}
