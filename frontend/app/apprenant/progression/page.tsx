"use client";

import { CircleCheck, Clock, Lock, PlayCircle, ShieldCheck, Star } from "lucide-react";
import Link from "next/link";

import { SimpleBarChart, TrendChart } from "@/components/charts/charts";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState, ErrorState, PageHeader, Progress, Skeleton, StatCard } from "@/components/ui/misc";
import { RISK } from "@/lib/constants";
import { cn } from "@/lib/cn";
import { formatDate, formatDuration, formatPercent, formatScore } from "@/lib/format";
import { useApi } from "@/lib/hooks";
import type { LearnerProgress } from "@/lib/types";

export default function ProgressPage() {
  const { data, error, isLoading, mutate } = useApi<LearnerProgress>("/api/me/progress/");

  if (error) return <ErrorState message={error.message} onRetry={() => mutate()} />;
  if (isLoading || !data)
    return (
      <>
        <PageHeader title="Ma progression" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-36 rounded-2xl" />
          ))}
        </div>
      </>
    );

  const risk = RISK[data.kpis.risk_level];
  const lastWeekIndex = data.weekly_minutes.length - 1;

  return (
    <>
      <PageHeader title="Ma progression" subtitle={data.goal ? `Ton parcours vers l'objectif « ${data.goal} »` : "Ton parcours d'apprentissage"} />
      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard icon={<Clock className="size-5" />} label="Temps total d'apprentissage" value={formatDuration(data.kpis.total_minutes)} />
          <StatCard icon={<CircleCheck className="size-5" />} tone="success" label="Cours terminés" value={`${data.kpis.completed_courses} / ${data.kpis.enrolled_courses}`} />
          <StatCard icon={<Star className="size-5" />} tone="warning" label="Score moyen aux quiz" value={formatScore(data.kpis.avg_quiz_score)} />
          <StatCard
            icon={<ShieldCheck className="size-5" />}
            tone={risk.tone === "danger" ? "danger" : risk.tone === "warning" ? "warning" : "success"}
            label="Risque de décrochage"
            value={data.kpis.risk_label}
            hint={data.segment ? `Ton profil : ${data.segment.name}` : undefined}
          />
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card>
            <CardBody>
              <CardHeader title="Temps d'étude par semaine" subtitle="8 dernières semaines, en minutes" />
              <div className="mt-5">
                <SimpleBarChart
                  data={data.weekly_minutes.map((w) => ({ label: w.label, value: w.minutes, title: `Semaine du ${formatDate(w.start, { day: "numeric", month: "short" })}` }))}
                  highlight={lastWeekIndex}
                  valueLabel="Temps"
                  format={(v) => formatDuration(v)}
                />
              </div>
              {data.weekly_note && <p className="mt-3 text-[13px] text-muted">{data.weekly_note}</p>}
            </CardBody>
          </Card>
          <Card>
            <CardBody>
              <CardHeader title="Scores aux quiz" subtitle="Tes 8 derniers quiz, en %" />
              <div className="mt-5">
                {data.quiz_scores.length ? (
                  <TrendChart
                    data={data.quiz_scores.map((q) => ({ label: q.label, value: q.score, title: q.quiz }))}
                    valueLabel="Score"
                    format={(v) => formatScore(v)}
                    domain={[0, 100]}
                    tickInterval={0}
                  />
                ) : (
                  <EmptyState title="Pas encore de quiz" description="Tes scores apparaîtront ici après ton premier quiz." className="py-8" />
                )}
              </div>
            </CardBody>
          </Card>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card>
            <CardBody>
              <CardHeader title="Compétences" subtitle="Progression moyenne par domaine" />
              <ul className="mt-5 space-y-4">
                {data.skills.length === 0 && <li className="text-sm text-muted">Tes compétences apparaîtront après ton premier cours.</li>}
                {data.skills.map((skill) => (
                  <li key={skill.name}>
                    <div className="mb-1.5 flex justify-between text-sm">
                      <span className="font-medium">{skill.name}</span>
                      <span className="text-muted">{formatPercent(skill.value)}</span>
                    </div>
                    <Progress value={skill.value} tone={skill.color} />
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>
          <Card>
            <CardBody>
              <CardHeader title="Mon parcours" />
              <ol className="mt-5 space-y-4">
                {data.path.map((step) => (
                  <li key={step.slug} className="flex items-center gap-3.5">
                    <span
                      className={cn(
                        "flex size-8 shrink-0 items-center justify-center rounded-full",
                        step.status === "done" && "bg-success-600 text-white",
                        step.status === "now" && "bg-brand-600 text-white",
                        step.status === "todo" && "border border-line bg-white text-muted",
                      )}
                    >
                      {step.status === "done" ? <CircleCheck className="size-4" /> : step.status === "now" ? <PlayCircle className="size-4" /> : <Lock className="size-3.5" />}
                    </span>
                    <div>
                      <Link href={step.status === "todo" ? `/cours/${step.slug}` : `/apprenant/apprendre/${step.slug}`} className={cn("text-sm font-semibold hover:underline", step.status === "todo" && "text-muted")}>
                        {step.title}
                      </Link>
                      <p className="text-xs text-muted">{step.detail}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
