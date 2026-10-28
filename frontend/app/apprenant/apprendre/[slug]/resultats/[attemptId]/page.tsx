"use client";

import { Award, Check, ChevronDown, PlayCircle, RotateCcw, Target, X } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";

import { ScoreRing } from "@/components/charts/charts";
import { CodeBlock } from "@/components/learning/lesson-content";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/misc";
import { PageLoader } from "@/components/ui/spinner";
import { RISK } from "@/lib/constants";
import { cn } from "@/lib/cn";
import { formatScore } from "@/lib/format";
import { useApi } from "@/lib/hooks";
import { stepHref } from "@/lib/routes";
import type { AttemptResult } from "@/lib/types";

export default function QuizResultPage() {
  const { slug, attemptId } = useParams<{ slug: string; attemptId: string }>();
  const { data: result, error, isLoading, mutate } = useApi<AttemptResult>(`/api/learn/attempts/${attemptId}/`);
  const [open, setOpen] = useState<number | null>(null);

  if (isLoading) return <PageLoader />;
  if (error || !result) return <ErrorState message={error?.message} onRetry={() => mutate()} />;

  return (
    <>
      <nav className="mb-4 text-[13px] text-muted" aria-label="Fil d'Ariane">
        <Link href={`/apprenant/apprendre/${slug}`} className="hover:text-ink">
          {result.course.title}
        </Link>
        <span className="mx-1.5">/</span>
        Module {result.module.order} · Résultats
      </nav>

      <Card className="mb-6">
        <CardBody className="flex flex-col items-center gap-6 text-center sm:flex-row sm:text-left">
          <ScoreRing value={result.score} label={`${result.correct_count} / ${result.total}`} />
          <div className="flex-1">
            <Badge tone={result.passed ? "success" : "warning"}>{result.passed ? "Module validé" : `Il faut ${result.pass_score} % pour valider`}</Badge>
            <h1 className="mt-3 text-2xl font-bold tracking-tight">
              {result.passed ? "Bravo, tu as réussi le quiz !" : "Pas encore, mais tu y es presque !"}
            </h1>
            <p className="mt-2 text-muted">
              {result.passed
                ? result.course_completed
                  ? "Tu as terminé le cours : ton certificat est disponible."
                  : `Tu as obtenu ${formatScore(result.score)}, au-dessus du seuil de ${result.pass_score} %.`
                : "Revois les notions ci-dessous puis retente le quiz : tes tentatives précédentes ne comptent pas contre toi."}
            </p>
            <div className="mt-5 flex flex-wrap justify-center gap-3 sm:justify-start">
              {result.course_completed ? (
                <LinkButton href={`/apprenant/certificats/${slug}`} icon={<Award className="size-4" />}>
                  Voir mon certificat
                </LinkButton>
              ) : result.passed ? (
                <LinkButton href={stepHref(slug, result.next)} icon={<PlayCircle className="size-4" />}>
                  {result.next ? "Étape suivante" : "Retour au cours"}
                </LinkButton>
              ) : (
                <LinkButton href={`/apprenant/apprendre/${slug}/quiz/${result.quiz.id}`} icon={<RotateCcw className="size-4" />}>
                  Retenter le quiz
                </LinkButton>
              )}
              <LinkButton href={`/apprenant/apprendre/${slug}`} variant="secondary">
                Plan du cours
              </LinkButton>
            </div>
          </div>
        </CardBody>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <Card>
          <CardBody>
            <CardHeader title="Détail des réponses" subtitle="Clique sur une question pour voir l'explication." />
            <ul className="mt-5 space-y-2.5">
              {result.questions.map((question, index) => {
                const expanded = open === question.id;
                return (
                  <li key={question.id} className="overflow-hidden rounded-xl border border-line">
                    <button onClick={() => setOpen(expanded ? null : question.id)} aria-expanded={expanded} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-50">
                      <span className={cn("flex size-7 shrink-0 items-center justify-center rounded-full text-white", question.is_correct ? "bg-success-600" : "bg-danger-600")}>
                        {question.is_correct ? <Check className="size-4" /> : <X className="size-4" />}
                      </span>
                      <span className="text-sm font-semibold">Q{index + 1}</span>
                      <span className="line-clamp-1 flex-1 text-sm">{question.text}</span>
                      <ChevronDown className={cn("size-4 shrink-0 text-muted transition-transform", expanded && "rotate-180")} />
                    </button>
                    {expanded && (
                      <div className="space-y-3 border-t border-line bg-slate-50/60 px-4 py-4">
                        {question.code && <CodeBlock code={question.code} />}
                        <ul className="space-y-1.5">
                          {question.choices.map((choice) => (
                            <li
                              key={choice.id}
                              className={cn(
                                "rounded-lg border px-3 py-2 text-sm",
                                choice.is_correct ? "border-green-300 bg-success-50 font-medium text-success-600" : choice.chosen ? "border-red-200 bg-danger-50 text-danger-600" : "border-line bg-white",
                              )}
                            >
                              {choice.text}
                              {choice.chosen && <span className="ml-2 text-xs font-semibold">(ta réponse)</span>}
                            </li>
                          ))}
                        </ul>
                        {question.explanation && <p className="text-sm text-muted">{question.explanation}</p>}
                        {question.lesson && !question.is_correct && (
                          <Link href={`/apprenant/apprendre/${slug}/lecon/${question.lesson.id}`} className="inline-block text-sm font-semibold text-brand-600 hover:underline">
                            Revoir la leçon « {question.lesson.title} » →
                          </Link>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </CardBody>
        </Card>

        <Card>
          <CardBody className="space-y-5">
            <CardHeader title="Ce que le système en déduit" />
            {result.strengths.length > 0 && (
              <div className="flex gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-success-50 text-success-600">
                  <Check className="size-[18px]" />
                </span>
                <div>
                  <p className="text-sm font-semibold">Points forts</p>
                  <p className="text-[13px] text-muted">{result.strengths.join(", ")}</p>
                </div>
              </div>
            )}
            {result.weaknesses.length > 0 && (
              <div className="flex gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-danger-50 text-danger-600">
                  <Target className="size-[18px]" />
                </span>
                <div>
                  <p className="text-sm font-semibold">À revoir</p>
                  <p className="text-[13px] text-muted">{result.weaknesses.map((w) => `${w.topic} (${w.errors} erreur${w.errors > 1 ? "s" : ""})`).join(", ")}</p>
                </div>
              </div>
            )}
            {result.remediation.length > 0 && (
              <div className="rounded-xl bg-brand-50 p-4">
                <p className="text-[13px] font-semibold text-brand-700">Recommandé avant de continuer</p>
                {result.remediation.map((lesson) => (
                  <Link key={lesson.id} href={`/apprenant/apprendre/${slug}/lecon/${lesson.id}`} className="mt-1 block font-semibold hover:underline">
                    {lesson.title}
                  </Link>
                ))}
              </div>
            )}
            {result.risk && (
              <div>
                <p className="text-[13px] font-medium">Ton risque de décrochage sur ce cours</p>
                <div className="mt-1.5 flex items-center gap-2">
                  <Badge tone={RISK[result.risk.level].tone}>{RISK[result.risk.level].label}</Badge>
                  <span className="text-[13px] text-muted">mis à jour chaque nuit</span>
                </div>
              </div>
            )}
            {result.history.length > 1 && (
              <div>
                <p className="text-[13px] font-medium">Historique de tes tentatives</p>
                <p className="mt-1 text-sm text-muted">{result.history.map((h) => formatScore(h.score)).join(" → ")}</p>
              </div>
            )}
          </CardBody>
        </Card>
      </div>
    </>
  );
}
