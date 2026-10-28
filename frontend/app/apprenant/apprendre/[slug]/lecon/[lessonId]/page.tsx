"use client";

import { ArrowLeft, ArrowRight, Check, CircleCheck, ClipboardList, PlayCircle } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { EventPanel } from "@/components/learning/event-panel";
import { LessonContent } from "@/components/learning/lesson-content";
import { VideoPlayer } from "@/components/learning/video-player";
import { Badge } from "@/components/ui/badge";
import { Button, LinkButton } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Textarea } from "@/components/ui/form";
import { ErrorState, Progress, Tabs } from "@/components/ui/misc";
import { PageLoader } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/toast";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/cn";
import { formatPercent } from "@/lib/format";
import { useApi } from "@/lib/hooks";
import { stepHref } from "@/lib/routes";
import { flushEvents, track } from "@/lib/tracking";
import type { LessonDetail, NextStep } from "@/lib/types";

/** Mesure le temps passé sur la leçon (onglet visible) et l'envoie en quittant. */
function useLessonTimer(courseId: number | undefined, lessonId: number) {
  useEffect(() => {
    if (!courseId) return;
    let visibleSince = document.visibilityState === "visible" ? Date.now() : 0;
    let total = 0;
    const onVisibility = () => {
      if (document.visibilityState === "hidden" && visibleSince) {
        total += (Date.now() - visibleSince) / 1000;
        visibleSince = 0;
      } else if (document.visibilityState === "visible") {
        visibleSince = Date.now();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      if (visibleSince) total += (Date.now() - visibleSince) / 1000;
      const seconds = Math.min(Math.round(total), 3 * 3600);
      if (seconds >= 5) track({ event_type: "lesson_time", course: courseId, lesson: lessonId, value: seconds });
      void flushEvents();
    };
  }, [courseId, lessonId]);
}

function NotesEditor({ lessonId, initial }: { lessonId: number; initial: string }) {
  const [value, setValue] = useState(initial);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const timer = setTimeout(async () => {
      setStatus("saving");
      try {
        await api(`/api/learn/lessons/${lessonId}/note/`, { method: "PUT", body: { content: value } });
        setStatus("saved");
      } catch {
        setStatus("error");
      }
    }, 800);
    return () => clearTimeout(timer);
  }, [value, lessonId]);

  return (
    <div>
      <Textarea
        rows={8}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="Écris ici ce que tu veux retenir de cette leçon. Tes notes sont enregistrées automatiquement."
        aria-label="Mes notes"
      />
      <p className="mt-2 text-xs text-muted" aria-live="polite">
        {status === "saving" ? "Enregistrement…" : status === "saved" ? "Notes enregistrées ✓" : status === "error" ? "Échec de l'enregistrement, réessaie." : "Enregistrement automatique"}
      </p>
    </div>
  );
}

export default function LessonPage() {
  const { slug, lessonId } = useParams<{ slug: string; lessonId: string }>();
  const id = Number(lessonId);
  const router = useRouter();
  const toast = useToast();
  const { data: lesson, error, isLoading, mutate } = useApi<LessonDetail>(`/api/learn/lessons/${id}/`);
  const [tab, setTab] = useState<"summary" | "notes">("summary");
  const [completing, setCompleting] = useState(false);
  useLessonTimer(lesson?.course.id, id);

  if (isLoading) return <PageLoader />;
  if (error || !lesson)
    return <ErrorState message={error?.status === 403 ? "Inscris-toi au cours pour accéder à cette leçon." : error?.message} onRetry={() => mutate()} />;

  async function complete() {
    setCompleting(true);
    try {
      const result = await api<{ course_completed: boolean; next: NextStep | null; progress: number }>(`/api/learn/lessons/${id}/complete/`, {
        method: "POST",
      });
      if (result.course_completed) {
        toast.success("Bravo, tu as terminé le cours ! 🎉");
        router.push(`/apprenant/certificats/${slug}`);
        return;
      }
      toast.success("Leçon terminée !");
      if (lesson?.next_lesson && lesson.module.lessons.some((l) => l.id === lesson.next_lesson)) {
        router.push(`/apprenant/apprendre/${slug}/lecon/${lesson.next_lesson}`);
      } else if (result.next) {
        router.push(stepHref(slug, result.next));
      } else {
        await mutate();
      }
    } catch (err) {
      toast.error((err as ApiError).message);
    } finally {
      setCompleting(false);
    }
  }

  const moduleDone = lesson.module.completed_count;

  return (
    <>
      <nav className="mb-4 text-[13px] text-muted" aria-label="Fil d'Ariane">
        <Link href="/apprenant/mes-cours" className="hover:text-ink">
          Mes cours
        </Link>
        <span className="mx-1.5">/</span>
        <Link href={`/apprenant/apprendre/${slug}`} className="hover:text-ink">
          {lesson.course.title}
        </Link>
        <span className="mx-1.5">/</span>
        Module {lesson.module.order} · Leçon {lesson.position} sur {lesson.total_lessons}
      </nav>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-5">
          {lesson.video_url ? (
            <VideoPlayer
              src={lesson.video_url}
              courseId={lesson.course.id}
              lessonId={lesson.id}
              startAt={lesson.completed ? 0 : lesson.last_position_seconds}
            />
          ) : (
            <div className="flex aspect-[21/9] items-center justify-center rounded-2xl bg-gradient-to-br from-brand-50 to-violet-50">
              <Badge tone="brand">Leçon à lire · {lesson.duration_minutes} min</Badge>
            </div>
          )}

          <div className="flex flex-wrap items-start justify-between gap-3">
            <h1 className="text-2xl font-bold tracking-tight">{lesson.title}</h1>
            {lesson.completed && (
              <Badge tone="success" icon={<Check className="size-3.5" />}>
                Leçon terminée
              </Badge>
            )}
          </div>

          <Tabs
            tabs={[
              { value: "summary", label: "Résumé" },
              { value: "notes", label: "Mes notes" },
            ]}
            value={tab}
            onChange={setTab}
          />
          <Card>
            <CardBody>{tab === "summary" ? <LessonContent content={lesson.content} /> : <NotesEditor key={lesson.id} lessonId={lesson.id} initial={lesson.note} />}</CardBody>
          </Card>

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
            {lesson.previous_lesson ? (
              <LinkButton href={`/apprenant/apprendre/${slug}/lecon/${lesson.previous_lesson}`} variant="secondary" icon={<ArrowLeft className="size-4" />}>
                Leçon précédente
              </LinkButton>
            ) : (
              <span />
            )}
            {lesson.completed ? (
              lesson.next_lesson ? (
                <LinkButton href={`/apprenant/apprendre/${slug}/lecon/${lesson.next_lesson}`}>
                  Leçon suivante <ArrowRight className="size-4" />
                </LinkButton>
              ) : (
                <LinkButton href={`/apprenant/apprendre/${slug}`}>Retour au plan du cours</LinkButton>
              )
            ) : (
              <Button onClick={complete} loading={completing} icon={<Check className="size-4" />}>
                Marquer comme terminée
              </Button>
            )}
          </div>
        </div>

        <aside className="space-y-5">
          <Card>
            <CardBody className="p-5">
              <p className="font-bold">
                Module {lesson.module.order} · {lesson.module.title}
              </p>
              <p className="mt-0.5 text-[13px] text-muted">
                {moduleDone} leçon{moduleDone > 1 ? "s" : ""} sur {lesson.module.lessons.length} terminée{moduleDone > 1 ? "s" : ""}
              </p>
              <Progress value={moduleDone / lesson.module.lessons.length} tone="success" size="sm" className="mt-3" />
              <ul className="mt-4 space-y-1">
                {lesson.module.lessons.map((item) => {
                  const current = item.id === lesson.id;
                  return (
                    <li key={item.id}>
                      <Link
                        href={`/apprenant/apprendre/${slug}/lecon/${item.id}`}
                        aria-current={current ? "page" : undefined}
                        className={cn("flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm", current ? "bg-brand-50 font-semibold text-brand-700" : "hover:bg-slate-50")}
                      >
                        {item.completed ? <CircleCheck className="size-[18px] shrink-0 text-success-600" /> : <PlayCircle className={cn("size-[18px] shrink-0", current ? "text-brand-600" : "text-slate-300")} />}
                        <span className="flex-1">{item.title}</span>
                        <span className="text-xs text-muted">{item.duration_minutes} min</span>
                      </Link>
                    </li>
                  );
                })}
                {lesson.quiz && (
                  <li>
                    <Link href={`/apprenant/apprendre/${slug}/quiz/${lesson.quiz.id}`} className="flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm font-medium text-brand-700 hover:bg-brand-50">
                      <ClipboardList className="size-[18px]" />
                      <span className="flex-1">Quiz du module</span>
                      {lesson.quiz.passed && <Badge tone="success">Réussi</Badge>}
                    </Link>
                  </li>
                )}
              </ul>
              <p className="mt-4 border-t border-line pt-3 text-xs text-muted">Progression du cours : {formatPercent(lesson.progress)}</p>
            </CardBody>
          </Card>
          <EventPanel key={lesson.id} lessonId={lesson.id} />
        </aside>
      </div>
    </>
  );
}
