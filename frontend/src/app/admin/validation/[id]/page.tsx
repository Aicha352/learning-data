"use client";

import { ChevronDown, CircleAlert, CircleCheck, CircleHelp, Eye, CirclePlay, Undo2, CircleX } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";

import { CourseCover } from "@/components/course/course-visuals";
import { LessonContent } from "@/components/learning/lesson-content";
import { Badge } from "@/components/ui/badge";
import { Button, LinkButton } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Textarea } from "@/components/ui/form";
import { Avatar, ErrorState } from "@/components/ui/misc";
import { ConfirmDialog } from "@/components/ui/modal";
import { PageLoader } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/toast";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/cn";
import { COURSE_STATUS_TONE } from "@/lib/constants";
import { formatDateTime, formatDuration } from "@/lib/format";
import { useApi } from "@/lib/hooks";
import type { InstructorCourseDetail } from "@/lib/types";

type Decision = "approve" | "request_changes" | "reject";

const DECISIONS: Record<Decision, { title: string; label: string; description: string; success: string }> = {
  approve: { title: "Publier ce cours ?", label: "Approuver et publier", description: "Le cours sera visible dans le catalogue et pourra être recommandé. Le formateur sera prévenu.", success: "Cours publié." },
  request_changes: { title: "Demander des modifications ?", label: "Renvoyer au formateur", description: "Le formateur recevra ton commentaire et pourra soumettre une nouvelle version.", success: "Demande de modifications envoyée." },
  reject: { title: "Refuser ce cours ?", label: "Refuser", description: "Le formateur recevra ton commentaire. Le cours ne sera pas publié.", success: "Cours refusé." },
};

export default function CourseReviewPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const { data: course, error, isLoading, mutate } = useApi<InstructorCourseDetail>(`/api/admin/course-reviews/${id}/`);
  const [comment, setComment] = useState("");
  const [commentError, setCommentError] = useState<string>();
  const [decision, setDecision] = useState<Decision | null>(null);
  const [busy, setBusy] = useState(false);
  const [openLesson, setOpenLesson] = useState<number | null>(null);

  if (isLoading) return <PageLoader />;
  if (error || !course) return <ErrorState message={error?.message} onRetry={() => mutate()} />;

  const failed = course.checklist.filter((c) => !c.ok);

  function ask(next: Decision) {
    if (next !== "approve" && !comment.trim()) {
      setCommentError("Explique au formateur ce qu'il doit changer.");
      return;
    }
    setCommentError(undefined);
    setDecision(next);
  }

  async function decide() {
    if (!decision) return;
    setBusy(true);
    try {
      await api(`/api/admin/course-reviews/${id}/`, { method: "POST", body: { decision, comment } });
      toast.success(DECISIONS[decision].success);
      router.push("/admin/validation");
    } catch (err) {
      const apiError = err as ApiError;
      setCommentError(apiError.field("comment"));
      toast.error(apiError.message);
      setBusy(false);
      setDecision(null);
    }
  }

  return (
    <>
      <Link href="/admin/validation" className="text-[13px] text-muted hover:text-ink">
        ← Validation des cours
      </Link>
      <div className="mt-3 mb-6 flex flex-col gap-4 sm:flex-row sm:items-center">
        <CourseCover color={course.cover_color} categorySlug={course.category.slug} accent={course.category.color} className="size-16 shrink-0 rounded-2xl" iconSize={28} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">{course.title}</h1>
            <Badge tone={COURSE_STATUS_TONE[course.status]}>{course.status_label}</Badge>
          </div>
          <p className="mt-1 text-sm text-muted">
            {course.category.name} · {course.level_label} · {course.modules.length} modules · {course.lesson_count} leçons · {formatDuration(course.duration_minutes)}
            {course.submitted_at && ` · soumis le ${formatDateTime(course.submitted_at)}`}
          </p>
        </div>
        <LinkButton href={`/cours/${course.slug}`} variant="secondary" icon={<Eye className="size-4" />}>
          Aperçu public
        </LinkButton>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          <Card>
            <CardBody>
              <div className="flex items-center gap-3">
                <Avatar initials={course.instructor.initials} color={course.instructor.avatar_color} size={40} />
                <div>
                  <p className="font-semibold">{course.instructor.full_name}</p>
                  <p className="text-xs text-muted">{course.instructor.headline || "Formateur"}</p>
                </div>
              </div>
              {course.subtitle && <p className="mt-4 font-medium">{course.subtitle}</p>}
              <p className="mt-2 text-sm leading-relaxed whitespace-pre-line text-ink/85">{course.description || <em className="text-muted">Pas de description.</em>}</p>
              {course.tags.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {course.tags.map((tag) => (
                    <Badge key={tag}>{tag}</Badge>
                  ))}
                </div>
              )}
              {course.learning_outcomes.length > 0 && (
                <>
                  <p className="mt-5 text-sm font-semibold">Objectifs</p>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                    {course.learning_outcomes.map((o) => (
                      <li key={o}>{o}</li>
                    ))}
                  </ul>
                </>
              )}
              {course.prerequisites && <p className="mt-4 text-sm text-muted">Prérequis : {course.prerequisites}</p>}
            </CardBody>
          </Card>

          <Card>
            <CardBody>
              <CardHeader title="Programme" subtitle="Clique sur une leçon pour lire son contenu." />
              <div className="mt-4 space-y-4">
                {course.modules.map((module, mIndex) => (
                  <div key={module.id} className="rounded-xl border border-line">
                    <div className="border-b border-line bg-slate-50 px-4 py-3">
                      <p className="text-sm font-semibold">
                        Module {mIndex + 1} · {module.title}
                      </p>
                    </div>
                    <ul className="divide-y divide-line">
                      {module.lessons.map((lesson) => (
                        <li key={lesson.id}>
                          <button type="button" className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm hover:bg-slate-50" onClick={() => setOpenLesson(openLesson === lesson.id ? null : lesson.id)} aria-expanded={openLesson === lesson.id}>
                            <CirclePlay className={cn("size-4 shrink-0", lesson.video_url ? "text-brand-600" : "text-slate-300")} />
                            <span className="flex-1">{lesson.title}</span>
                            <span className="text-xs text-muted">{lesson.duration_minutes} min</span>
                            <ChevronDown className={cn("size-4 text-muted transition-transform", openLesson === lesson.id && "rotate-180")} />
                          </button>
                          {openLesson === lesson.id && (
                            <div className="border-t border-line bg-white px-4 py-4">
                              {lesson.video_url && (
                                <p className="mb-3 text-xs text-muted">
                                  Vidéo :{" "}
                                  <a href={lesson.video_url} target="_blank" rel="noreferrer" className="text-brand-600 hover:underline">
                                    {lesson.video_url}
                                  </a>
                                </p>
                              )}
                              {lesson.content ? <LessonContent content={lesson.content} /> : <p className="text-sm text-muted italic">Aucun contenu texte.</p>}
                            </div>
                          )}
                        </li>
                      ))}
                      {!module.lessons.length && <li className="px-4 py-3 text-sm text-danger-600">Aucune leçon dans ce module.</li>}
                      <li className="flex items-center gap-3 px-4 py-2.5 text-sm">
                        <CircleHelp className={cn("size-4", module.quiz ? "text-violet-600" : "text-danger-600")} />
                        {module.quiz ? (
                          <span>
                            Quiz : {module.quiz.question_count} questions · réussite à {module.quiz.pass_score} %
                          </span>
                        ) : (
                          <span className="text-danger-600">Pas de quiz</span>
                        )}
                      </li>
                    </ul>
                  </div>
                ))}
                {!course.modules.length && <p className="text-sm text-danger-600">Ce cours n&apos;a encore aucun module.</p>}
              </div>
            </CardBody>
          </Card>
        </div>

        <div className="space-y-6 xl:sticky xl:top-24 xl:self-start">
          <Card>
            <CardBody>
              <CardHeader title="Vérification automatique" subtitle={failed.length ? `${failed.length} point(s) à corriger` : "Tous les critères sont remplis"} />
              <ul className="mt-4 space-y-2.5">
                {course.checklist.map((item) => (
                  <li key={item.key} className="flex items-start gap-2.5 text-sm">
                    {item.ok ? <CircleCheck className="mt-0.5 size-4 shrink-0 text-success-600" /> : <CircleAlert className="mt-0.5 size-4 shrink-0 text-danger-600" />}
                    <span className={cn(!item.ok && "text-danger-600")}>
                      {item.label}
                      {item.detail && <span className="block text-xs text-muted">{item.detail}</span>}
                    </span>
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>

          <Card>
            <CardBody>
              <CardHeader title="Décision" />
              {course.review_comment && course.status !== "pending" && (
                <p className="mt-3 rounded-lg bg-slate-50 p-3 text-xs text-muted">Dernier commentaire : {course.review_comment}</p>
              )}
              <Textarea
                containerClassName="mt-4"
                label="Commentaire pour le formateur"
                rows={4}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                error={commentError}
                placeholder="Obligatoire pour demander des modifications ou refuser."
              />
              <div className="mt-4 grid gap-2">
                {course.status !== "published" && (
                  <Button icon={<CircleCheck className="size-4" />} onClick={() => ask("approve")}>
                    Approuver et publier
                  </Button>
                )}
                <Button variant="secondary" icon={<Undo2 className="size-4" />} onClick={() => ask("request_changes")}>
                  Demander des modifications
                </Button>
                <Button variant="danger-ghost" icon={<CircleX className="size-4" />} onClick={() => ask("reject")}>
                  Refuser
                </Button>
              </div>
            </CardBody>
          </Card>
        </div>
      </div>

      {decision && (
        <ConfirmDialog
          open
          onClose={() => setDecision(null)}
          onConfirm={decide}
          loading={busy}
          danger={decision === "reject"}
          title={DECISIONS[decision].title}
          description={DECISIONS[decision].description}
          confirmLabel={DECISIONS[decision].label}
        />
      )}
    </>
  );
}
