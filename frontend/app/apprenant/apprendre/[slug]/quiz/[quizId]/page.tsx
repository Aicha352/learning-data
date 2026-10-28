"use client";

import { ArrowLeft, ArrowRight, Clock, Lightbulb, Send } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { CodeBlock } from "@/components/learning/lesson-content";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/modal";
import { ErrorState, Progress } from "@/components/ui/misc";
import { PageLoader } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/toast";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/cn";
import { formatScore } from "@/lib/format";
import { useApi } from "@/lib/hooks";
import { track } from "@/lib/tracking";
import type { QuizDetail } from "@/lib/types";

function useElapsed() {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(timer);
  }, []);
  return seconds;
}

export default function QuizPage() {
  const { slug, quizId } = useParams<{ slug: string; quizId: string }>();
  const router = useRouter();
  const toast = useToast();
  const { data: quiz, error, isLoading, mutate } = useApi<QuizDetail>(`/api/learn/quizzes/${quizId}/`);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [hints, setHints] = useState<Set<number>>(new Set());
  const [confirm, setConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const elapsed = useElapsed();

  if (isLoading) return <PageLoader />;
  if (error || !quiz) return <ErrorState message={error?.status === 403 ? "Inscris-toi au cours pour passer ce quiz." : error?.message} onRetry={() => mutate()} />;

  const question = quiz.questions[index];
  const answered = Object.keys(answers).length;
  const total = quiz.questions.length;
  const mm = String(Math.floor(elapsed / 60)).padStart(2, "0");
  const ss = String(elapsed % 60).padStart(2, "0");

  function showHint() {
    if (!question || hints.has(question.id)) return;
    setHints(new Set(hints).add(question.id));
    track({ event_type: "hint_used", course: quiz!.course.id, metadata: { quiz: quiz!.id, question: question.id } });
  }

  async function submit() {
    setSubmitting(true);
    try {
      const result = await api<{ attempt_id: number }>(`/api/learn/quizzes/${quizId}/submit/`, {
        method: "POST",
        body: {
          answers: quiz!.questions.map((q) => ({ question: q.id, choice: answers[q.id] ?? null })),
          hints_used: hints.size,
          duration_seconds: elapsed,
        },
      });
      router.push(`/apprenant/apprendre/${slug}/resultats/${result.attempt_id}`);
    } catch (err) {
      toast.error((err as ApiError).message);
      setSubmitting(false);
      setConfirm(false);
    }
  }

  if (!question) return <ErrorState message="Ce quiz ne contient pas encore de question." />;

  return (
    <>
      <nav className="mb-4 text-[13px] text-muted" aria-label="Fil d'Ariane">
        <Link href={`/apprenant/apprendre/${slug}`} className="hover:text-ink">
          {quiz.course.title}
        </Link>
        <span className="mx-1.5">/</span>
        Module {quiz.module.order} · Quiz
      </nav>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-[28px]">{quiz.title}</h1>
          <p className="mt-1 text-[15px] text-muted">
            {total} questions · Il faut {quiz.pass_score} % pour valider le module
            {quiz.attempts.length > 0 && ` · Meilleur score : ${formatScore(Math.max(...quiz.attempts.map((a) => a.score)))}`}
          </p>
        </div>
        <span className="inline-flex items-center gap-2 rounded-xl border border-line bg-white px-3.5 py-2 font-semibold tabular-nums" aria-label="Temps écoulé">
          <Clock className="size-[18px] text-warning-500" /> {mm}:{ss}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <Card>
          <CardBody className="space-y-5">
            <div className="flex justify-between text-sm">
              <span className="font-semibold text-brand-600">
                Question {index + 1} sur {total}
              </span>
              <span className="text-muted">1 point</span>
            </div>
            <Progress value={(index + 1) / total} size="sm" />
            <h2 className="text-xl font-bold">{question.text}</h2>
            {question.code && <CodeBlock code={question.code} />}
            <div className="space-y-3" role="radiogroup" aria-label="Réponses">
              {question.choices.map((choice, choiceIndex) => {
                const selected = answers[question.id] === choice.id;
                return (
                  <button
                    key={choice.id}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setAnswers({ ...answers, [question.id]: choice.id })}
                    className={cn(
                      "flex w-full items-center gap-3.5 rounded-xl border p-4 text-left text-[15px] font-medium transition-colors",
                      selected ? "border-brand-600 bg-brand-50 text-brand-700 ring-1 ring-brand-600" : "border-line hover:border-slate-300 hover:bg-slate-50",
                    )}
                  >
                    <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold", selected ? "bg-brand-600 text-white" : "bg-slate-100")}>
                      {String.fromCharCode(65 + choiceIndex)}
                    </span>
                    {choice.text}
                  </button>
                );
              })}
            </div>
            <div className="flex flex-col-reverse gap-3 border-t border-line pt-5 sm:flex-row sm:justify-between">
              <Button variant="secondary" disabled={index === 0} onClick={() => setIndex(index - 1)} icon={<ArrowLeft className="size-4" />}>
                Question précédente
              </Button>
              {index < total - 1 ? (
                <Button onClick={() => setIndex(index + 1)}>
                  Question suivante <ArrowRight className="size-4" />
                </Button>
              ) : (
                <Button onClick={() => (answered < total ? setConfirm(true) : submit())} loading={submitting} icon={<Send className="size-4" />}>
                  Valider mes réponses
                </Button>
              )}
            </div>
          </CardBody>
        </Card>

        <aside className="space-y-5">
          <Card>
            <CardBody className="p-5">
              <p className="font-bold">Questions</p>
              <div className="mt-4 grid grid-cols-5 gap-2">
                {quiz.questions.map((q, i) => (
                  <button
                    key={q.id}
                    onClick={() => setIndex(i)}
                    aria-label={`Question ${i + 1}${answers[q.id] ? " (répondue)" : ""}`}
                    aria-current={i === index ? "step" : undefined}
                    className={cn(
                      "aspect-square rounded-lg text-sm font-semibold transition-colors",
                      i === index ? "bg-brand-600 text-white" : answers[q.id] ? "bg-success-50 text-success-600" : "border border-line bg-white text-muted hover:bg-slate-50",
                    )}
                  >
                    {i + 1}
                  </button>
                ))}
              </div>
              <p className="mt-4 text-[13px] text-muted">
                {answered} / {total} répondues
              </p>
              {answered === total && (
                <Button fullWidth className="mt-4" onClick={submit} loading={submitting}>
                  Valider mes réponses
                </Button>
              )}
            </CardBody>
          </Card>
          {question.hint && (
            <Card className="bg-warning-50">
              <CardBody className="p-5">
                <p className="flex items-center gap-2 font-semibold">
                  <Lightbulb className="size-[18px] text-warning-500" /> Besoin d&apos;un indice ?
                </p>
                {hints.has(question.id) ? (
                  <p className="mt-2 text-sm">{question.hint}</p>
                ) : (
                  <>
                    <p className="mt-2 text-[13px] text-muted">Utiliser un indice est enregistré, mais ne fait pas perdre de points.</p>
                    <Button variant="secondary" size="sm" className="mt-3" onClick={showHint}>
                      Afficher l&apos;indice
                    </Button>
                  </>
                )}
              </CardBody>
            </Card>
          )}
          {quiz.attempts.length > 0 && (
            <Card>
              <CardBody className="p-5">
                <p className="font-bold">Tes tentatives</p>
                <ul className="mt-3 space-y-2 text-sm">
                  {quiz.attempts.map((attempt) => (
                    <li key={attempt.id} className="flex items-center justify-between">
                      <Link href={`/apprenant/apprendre/${slug}/resultats/${attempt.id}`} className="text-muted hover:text-ink hover:underline">
                        {new Date(attempt.submitted_at).toLocaleDateString("fr-FR")}
                      </Link>
                      <Badge tone={attempt.passed ? "success" : "warning"}>{formatScore(attempt.score)}</Badge>
                    </li>
                  ))}
                </ul>
              </CardBody>
            </Card>
          )}
        </aside>
      </div>

      <ConfirmDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        onConfirm={submit}
        loading={submitting}
        title="Valider sans tout répondre ?"
        description={`Tu as répondu à ${answered} question${answered > 1 ? "s" : ""} sur ${total}. Les questions sans réponse seront comptées comme fausses.`}
        confirmLabel="Valider quand même"
      />
    </>
  );
}
