"use client";

import { Award, CircleCheck, ClipboardList, PlayCircle } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ErrorState, PageHeader, Progress } from "@/components/ui/misc";
import { PageLoader } from "@/components/ui/spinner";
import { cn } from "@/lib/cn";
import { formatPercent, formatScore } from "@/lib/format";
import { useApi } from "@/lib/hooks";
import { stepHref } from "@/lib/routes";
import type { LearnCourse } from "@/lib/types";

export default function LearnCoursePage() {
  const { slug } = useParams<{ slug: string }>();
  const { data, error, isLoading, mutate } = useApi<LearnCourse>(`/api/learn/courses/${slug}/`);

  if (isLoading) return <PageLoader />;
  if (error || !data)
    return (
      <ErrorState
        message={error?.status === 403 ? "Tu n'es pas inscrit à ce cours." : error?.message}
        onRetry={() => mutate()}
      />
    );

  const completed = data.enrollment.status === "completed";

  return (
    <>
      <PageHeader
        breadcrumb={
          <>
            <Link href="/apprenant/mes-cours" className="hover:text-ink">
              Mes cours
            </Link>{" "}
            / {data.course.title}
          </>
        }
        title={data.course.title}
        subtitle={`Avec ${data.course.instructor}`}
        actions={
          completed ? (
            <LinkButton href={`/apprenant/certificats/${slug}`} icon={<Award className="size-4" />}>
              Mon certificat
            </LinkButton>
          ) : (
            <LinkButton href={stepHref(slug, data.next)} icon={<PlayCircle className="size-4" />}>
              {data.next ? "Continuer" : "Revoir le cours"}
            </LinkButton>
          )
        }
      />
      <Card className="mb-6 p-5">
        <div className="mb-2 flex justify-between text-sm">
          <span className="font-medium">{completed ? "Cours terminé 🎉" : "Progression dans le cours"}</span>
          <span className="font-semibold">{formatPercent(data.enrollment.progress)}</span>
        </div>
        <Progress value={data.enrollment.progress} tone={completed ? "success" : "brand"} size="lg" />
        {data.next && (
          <p className="mt-3 text-sm text-muted">
            Prochaine étape : <span className="font-medium text-ink">{data.next.title}</span> ({data.next.module_title})
          </p>
        )}
      </Card>

      <div className="space-y-4">
        {data.modules.map((module) => {
          const done = module.completed_lessons === module.lessons.length && (!module.quiz || module.quiz.passed);
          return (
            <Card key={module.id} className="overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-slate-50 px-5 py-3.5">
                <p className="font-semibold">
                  Module {module.order} · {module.title}
                </p>
                {done ? (
                  <Badge tone="success">Validé</Badge>
                ) : (
                  <span className="text-[13px] text-muted">
                    {module.completed_lessons} / {module.lessons.length} leçons
                  </span>
                )}
              </div>
              <ul className="divide-y divide-line">
                {module.lessons.map((lesson) => (
                  <li key={lesson.id}>
                    <Link href={`/apprenant/apprendre/${slug}/lecon/${lesson.id}`} className="flex items-center gap-3 px-5 py-3 text-sm hover:bg-slate-50">
                      {lesson.completed ? <CircleCheck className="size-5 text-success-600" /> : <PlayCircle className="size-5 text-muted" />}
                      <span className={cn("flex-1", lesson.completed && "text-muted")}>{lesson.title}</span>
                      <span className="text-xs text-muted">{lesson.duration_minutes} min</span>
                    </Link>
                  </li>
                ))}
                {module.quiz && (
                  <li>
                    <Link href={`/apprenant/apprendre/${slug}/quiz/${module.quiz.id}`} className="flex items-center gap-3 px-5 py-3 text-sm font-medium text-brand-700 hover:bg-brand-50/60">
                      <ClipboardList className="size-5" />
                      <span className="flex-1">
                        {module.quiz.title} · {module.quiz.question_count} questions
                      </span>
                      {module.quiz.best_score !== null && (
                        <Badge tone={module.quiz.passed ? "success" : "warning"}>Meilleur score : {formatScore(module.quiz.best_score)}</Badge>
                      )}
                    </Link>
                  </li>
                )}
              </ul>
            </Card>
          );
        })}
      </div>
    </>
  );
}
