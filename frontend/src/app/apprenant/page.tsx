"use client";

import { BellRing, BookOpen, CircleCheck, Clock, Flame, PlayCircle, Sparkles } from "lucide-react";
import Link from "next/link";

import { CourseCard, CourseCardSkeleton } from "@/components/course/course-card";
import { CourseCover } from "@/components/course/course-visuals";
import { LinkButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState, ErrorState, PageHeader, Progress, Skeleton, StatCard } from "@/components/ui/misc";
import { useAuth } from "@/lib/auth";
import { formatDuration, formatPercent, plural } from "@/lib/format";
import { useApi } from "@/lib/hooks";
import { stepHref } from "@/lib/routes";
import type { LearnerDashboard, RecommendationsResponse } from "@/lib/types";

export default function LearnerDashboardPage() {
  const { user } = useAuth();
  const { data, error, isLoading, mutate } = useApi<LearnerDashboard>("/api/me/dashboard/");
  const { data: recos } = useApi<RecommendationsResponse>("/api/recommendations/?limit=3");

  const hour = new Date().getHours();
  const greeting = hour < 18 ? "Bonjour" : "Bonsoir";

  return (
    <>
      <PageHeader title={`${greeting} ${user?.first_name ?? ""}`} subtitle="C’est le moment d’apprendre : chaque petite leçon compte." />

      {error ? (
        <ErrorState message={error.message} onRetry={() => mutate()} />
      ) : isLoading || !data ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-36 rounded-2xl" />
          ))}
        </div>
      ) : (
        <div className="space-y-8">
          {!data.onboarding_completed && (
            <Card className="flex flex-col gap-4 border-brand-200 bg-brand-50 p-5 sm:flex-row sm:items-center">
              <Sparkles className="size-6 shrink-0 text-brand-600" />
              <p className="flex-1 text-sm">
                <span className="font-semibold">Réponds à 3 questions</span> pour recevoir des recommandations vraiment adaptées à ton objectif.
              </p>
              <LinkButton href="/bienvenue" size="sm">
                Compléter mon profil
              </LinkButton>
            </Card>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard icon={<BookOpen className="size-5" />} label="Cours en cours" value={data.kpis.courses_in_progress} />
            <StatCard icon={<CircleCheck className="size-5" />} tone="success" label="Leçons terminées" value={data.kpis.lessons_completed} />
            <StatCard icon={<Clock className="size-5" />} tone="warning" label="Temps cette semaine" value={formatDuration(data.kpis.minutes_this_week)} />
            <StatCard icon={<Flame className="size-5" />} tone="danger" label="Série en cours" value={plural(data.kpis.streak_days, "jour")} />
          </div>

          {data.nudge && (
            <Card className="flex flex-col gap-4 border-warning-500/30 bg-warning-50 p-5 sm:flex-row sm:items-center">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-white text-warning-500">
                <BellRing className="size-5" />
              </span>
              <div className="flex-1">
                <p className="font-semibold">
                  Tu n&apos;as pas avancé sur « {data.nudge.course.title} » depuis {data.nudge.days} jours
                </p>
                <p className="mt-0.5 text-sm text-muted">
                  Reprends en douceur avec une leçon courte. Tu en es à {formatPercent(data.nudge.progress)}.
                </p>
              </div>
              <LinkButton href={stepHref(data.nudge.course.slug, data.nudge.next)}>Reprendre</LinkButton>
            </Card>
          )}

          <section>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-bold">Continuer mes cours</h2>
              <Link href="/apprenant/mes-cours" className="text-sm font-semibold text-brand-600 hover:underline">
                Mes cours →
              </Link>
            </div>
            {data.continue.length === 0 ? (
              <EmptyState
                title="Aucun cours en cours"
                description={data.completed_count ? "Bravo, tu as terminé tous tes cours ! Choisis la suite parmi tes recommandations." : "Inscris-toi à un premier cours pour commencer."}
                action={<LinkButton href="/apprenant/recommandations">Voir mes recommandations</LinkButton>}
              />
            ) : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {data.continue.map((card) => (
                  <Card key={card.enrollment_id} className="flex flex-col p-5">
                    <div className="flex items-center gap-3">
                      <CourseCover color={card.course.cover_color} accent={card.course.category_color} className="size-12 shrink-0 rounded-xl" iconSize={22} />
                      <div className="min-w-0">
                        <Link href={`/apprenant/apprendre/${card.course.slug}`} className="line-clamp-1 font-semibold hover:text-brand-700">
                          {card.course.title}
                        </Link>
                        <p className="line-clamp-1 text-[13px] text-muted">{card.next ? card.next.module_title : card.course.category}</p>
                      </div>
                    </div>
                    <div className="mt-5 flex justify-between text-[13px]">
                      <span className="text-muted">Progression</span>
                      <span className="font-semibold">{formatPercent(card.progress)}</span>
                    </div>
                    <Progress value={card.progress} tone={card.progress < 0.5 ? "warning" : "brand"} className="mt-2" />
                    <LinkButton href={stepHref(card.course.slug, card.next)} variant="secondary" size="sm" className="mt-5" icon={<PlayCircle className="size-4" />}>
                      {card.next ? (card.next.type === "quiz" ? "Passer le quiz" : "Leçon suivante") : "Voir le cours"}
                    </LinkButton>
                  </Card>
                ))}
              </div>
            )}
          </section>

          <section>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-bold">Recommandés pour toi</h2>
              <Link href="/apprenant/recommandations" className="text-sm font-semibold text-brand-600 hover:underline">
                Toutes les recommandations →
              </Link>
            </div>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {!recos
                ? Array.from({ length: 3 }, (_, i) => <CourseCardSkeleton key={i} />)
                : recos.results.slice(0, 3).map((course) => <CourseCard key={course.id} course={course} />)}
            </div>
          </section>
        </div>
      )}
    </>
  );
}
