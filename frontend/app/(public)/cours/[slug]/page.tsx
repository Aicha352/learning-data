"use client";

import { Award, Check, ChevronDown, Clock, PlayCircle, Sparkles, Users } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";

import { CourseCard } from "@/components/course/course-card";
import { CourseCover, Rating, StarInput } from "@/components/course/course-visuals";
import { Badge } from "@/components/ui/badge";
import { Button, LinkButton } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Textarea } from "@/components/ui/form";
import { Avatar, ErrorState, Progress } from "@/components/ui/misc";
import { PageLoader } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/toast";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/cn";
import { SOURCE_LABELS } from "@/lib/constants";
import { formatDate, formatDuration, formatNumber, formatPercent } from "@/lib/format";
import { useApi } from "@/lib/hooks";
import { stepHref } from "@/lib/routes";
import type { CourseDetail, CourseSummary, NextStep } from "@/lib/types";

export default function CourseDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const { user } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const { data: course, error, isLoading, mutate } = useApi<CourseDetail>(`/api/courses/${slug}/`);
  const { data: similar } = useApi<CourseSummary[]>(user ? `/api/courses/${slug}/similar/` : null);
  const [enrolling, setEnrolling] = useState(false);
  const [openModule, setOpenModule] = useState<number | null>(0);

  if (isLoading) return <PageLoader />;
  if (error || !course)
    return (
      <div className="mx-auto max-w-3xl px-4 py-16">
        <ErrorState message={error?.status === 404 ? "Ce cours n'existe pas ou n'est pas encore publié." : error?.message} onRetry={() => mutate()} />
      </div>
    );

  const isLearner = user?.role === "learner";
  const enrollment = course.enrollment;

  async function enroll() {
    if (!user) {
      router.push(`/connexion?next=/cours/${slug}`);
      return;
    }
    setEnrolling(true);
    try {
      const data = await api<{ next: NextStep | null }>(`/api/courses/${slug}/enroll/`, { method: "POST" });
      toast.success("Inscription confirmée, bon apprentissage !");
      router.push(stepHref(slug, data.next));
    } catch (err) {
      toast.error((err as ApiError).message);
      setEnrolling(false);
    }
  }

  const totalMinutes = course.duration_minutes;

  return (
    <div>
      {/* En-tête */}
      <section className="bg-navy text-white">
        <div className="mx-auto grid grid-cols-1 max-w-7xl gap-10 px-4 py-10 sm:px-6 lg:grid-cols-[1fr_380px] lg:px-8 lg:py-14">
          <div className="min-w-0">
            <nav className="text-sm text-slate-300" aria-label="Fil d'Ariane">
              <Link href="/catalogue" className="hover:text-white">
                Catalogue
              </Link>
              <span className="mx-2">/</span>
              <Link href={`/catalogue?category=${course.category.slug}`} className="hover:text-white">
                {course.category.name}
              </Link>
            </nav>
            {course.status !== "published" && <Badge tone="warning" className="mt-4">Aperçu · cours non publié</Badge>}
            <h1 className="mt-4 text-3xl leading-tight font-bold tracking-tight sm:text-4xl">{course.title}</h1>
            <p className="mt-4 max-w-3xl text-[17px] leading-relaxed text-slate-200">{course.subtitle}</p>
            <div className="mt-6 flex flex-wrap gap-2">
              {[course.level_label, formatDuration(totalMinutes), `${course.lesson_count} leçons`, `${formatNumber(course.enrolled_count)} inscrits`].map((item) => (
                <span key={item} className="rounded-md bg-white/10 px-2.5 py-1 text-xs font-semibold">
                  {item}
                </span>
              ))}
              {course.avg_rating !== null && (
                <span className="rounded-md bg-white/10 px-2.5 py-1 text-xs font-semibold">
                  ★ {formatNumber(course.avg_rating, 1)} · {formatNumber(course.review_count)} avis
                </span>
              )}
            </div>
            <div className="mt-7 flex items-center gap-3">
              <Avatar initials={course.instructor.initials} color={course.instructor.avatar_color} size={44} />
              <div>
                <p className="font-semibold">{course.instructor.full_name}</p>
                <p className="text-sm text-slate-300">{course.instructor.headline}</p>
              </div>
            </div>
          </div>

          {/* Carte d'inscription */}
          <Card className="self-start overflow-hidden text-ink lg:row-span-2">
            <CourseCover color={course.cover_color} categorySlug={course.category.slug} accent={course.category.color} className="h-40" iconSize={52} />
            <div className="space-y-4 p-6">
              {enrollment ? (
                <>
                  <div>
                    <div className="mb-2 flex justify-between text-sm">
                      <span className="font-medium">{enrollment.status === "completed" ? "Cours terminé" : "Ta progression"}</span>
                      <span className="font-semibold">{formatPercent(enrollment.progress)}</span>
                    </div>
                    <Progress value={enrollment.progress} tone={enrollment.status === "completed" ? "success" : "brand"} />
                  </div>
                  {enrollment.status === "completed" ? (
                    <div className="space-y-2">
                      <LinkButton href={`/apprenant/certificats/${slug}`} fullWidth icon={<Award className="size-4" />}>
                        Voir mon certificat
                      </LinkButton>
                      <LinkButton href={`/apprenant/apprendre/${slug}`} fullWidth variant="secondary">
                        Revoir le cours
                      </LinkButton>
                    </div>
                  ) : (
                    <LinkButton href={stepHref(slug, enrollment.next)} fullWidth size="lg" icon={<PlayCircle className="size-5" />}>
                      Continuer le cours
                    </LinkButton>
                  )}
                </>
              ) : (
                <>
                  <p className="text-2xl font-bold">Gratuit</p>
                  {user && !isLearner ? (
                    <p className="rounded-lg bg-slate-50 p-3 text-sm text-muted">Connecte-toi avec un compte apprenant pour suivre ce cours.</p>
                  ) : (
                    <Button fullWidth size="lg" onClick={enroll} loading={enrolling} disabled={course.status !== "published"}>
                      {user ? "S'inscrire au cours" : "Se connecter pour s'inscrire"}
                    </Button>
                  )}
                </>
              )}
              {course.recommendation && (
                <div className="space-y-2 rounded-xl bg-success-50 p-3.5">
                  <div className="flex justify-between text-[13px] font-semibold text-success-600">
                    <span>Correspondance avec ton profil</span>
                    <span>{formatPercent(course.recommendation.score)}</span>
                  </div>
                  <Progress value={course.recommendation.score} tone="success" size="sm" />
                </div>
              )}
              <ul className="space-y-2 text-sm text-muted">
                <li className="flex items-center gap-2">
                  <Clock className="size-4" /> {formatDuration(totalMinutes)} de contenu
                </li>
                <li className="flex items-center gap-2">
                  <Award className="size-4" /> Certificat à la fin du cours
                </li>
                <li className="flex items-center gap-2">
                  <Users className="size-4" /> Un quiz à la fin de chaque module
                </li>
              </ul>
            </div>
          </Card>
        </div>
      </section>

      <div className="mx-auto grid grid-cols-1 max-w-7xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[1fr_380px] lg:px-8">
        <div className="min-w-0 space-y-6">
          <Card>
            <CardBody>
              <h2 className="text-xl font-bold">À propos de ce cours</h2>
              <p className="mt-3 leading-relaxed whitespace-pre-line text-muted">{course.description}</p>
              {course.learning_outcomes.length > 0 && (
                <>
                  <h3 className="mt-6 font-semibold">Ce que tu vas apprendre</h3>
                  <ul className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {course.learning_outcomes.map((outcome) => (
                      <li key={outcome} className="flex items-start gap-2.5 text-[15px]">
                        <Check className="mt-0.5 size-[18px] shrink-0 text-success-600" />
                        {outcome}
                      </li>
                    ))}
                  </ul>
                </>
              )}
              {course.prerequisites && <p className="mt-5 text-sm text-muted">Prérequis : {course.prerequisites}</p>}
            </CardBody>
          </Card>

          <Card>
            <CardBody>
              <h2 className="text-xl font-bold">Programme du cours</h2>
              <p className="mt-1 text-sm text-muted">
                {course.modules.length} modules · {course.lesson_count} leçons · {formatDuration(totalMinutes)}
              </p>
              <div className="mt-5 space-y-2.5">
                {course.modules.map((module, index) => {
                  const open = openModule === index;
                  return (
                    <div key={module.id} className="overflow-hidden rounded-xl border border-line">
                      <button
                        onClick={() => setOpenModule(open ? null : index)}
                        aria-expanded={open}
                        className="flex w-full items-center justify-between gap-3 bg-slate-50 px-4 py-3.5 text-left hover:bg-slate-100"
                      >
                        <span className="font-semibold">
                          Module {module.order} · {module.title}
                        </span>
                        <span className="flex shrink-0 items-center gap-3 text-sm text-muted">
                          <span className="hidden sm:inline">
                            {module.lessons.length} leçons · {formatDuration(module.duration_minutes)}
                          </span>
                          <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} />
                        </span>
                      </button>
                      {open && (
                        <ul className="divide-y divide-line">
                          {module.lessons.map((lesson) => (
                            <li key={lesson.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                              <span className="flex items-center gap-2.5">
                                <PlayCircle className="size-4 text-muted" />
                                {lesson.title}
                              </span>
                              <span className="text-muted">{lesson.duration_minutes} min</span>
                            </li>
                          ))}
                          {module.has_quiz && (
                            <li className="flex items-center gap-2.5 px-4 py-3 text-sm text-brand-700">
                              <Award className="size-4" /> Quiz du module
                            </li>
                          )}
                        </ul>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardBody>
          </Card>

          <ReviewsSection course={course} canReview={Boolean(isLearner && enrollment)} onSaved={() => mutate()} />
        </div>

        <div className="space-y-6">
          {course.recommendation && (
            <Card>
              <CardBody>
                <h2 className="flex items-center gap-2 font-bold">
                  <Sparkles className="size-5 text-warning-500" /> Pourquoi ce cours pour toi ?
                </h2>
                <ul className="mt-4 space-y-3.5">
                  {course.recommendation.reasons.map((reason) => (
                    <li key={reason.text} className="text-sm leading-relaxed">
                      <span className="mb-0.5 block text-xs font-semibold text-brand-600">{SOURCE_LABELS[reason.source]}</span>
                      {reason.text}
                    </li>
                  ))}
                </ul>
                <p className="mt-4 text-xs text-muted">Explication générée par le modèle hybride (filtrage collaboratif + contenu + profil).</p>
              </CardBody>
            </Card>
          )}
          {similar && similar.length > 0 && (
            <div>
              <h2 className="mb-3 font-bold">Cours similaires</h2>
              <div className="space-y-4">
                {similar.slice(0, 3).map((item) => (
                  <CourseCard key={item.id} course={item} />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ReviewsSection({ course, canReview, onSaved }: { course: CourseDetail; canReview: boolean; onSaved: () => void }) {
  const toast = useToast();
  const [rating, setRating] = useState(course.my_review?.rating ?? 0);
  const [comment, setComment] = useState(course.my_review?.comment ?? "");
  const [saving, setSaving] = useState(false);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!rating) {
      toast.error("Choisis une note entre 1 et 5 étoiles.");
      return;
    }
    setSaving(true);
    try {
      await api(`/api/courses/${course.slug}/review/`, { method: "POST", body: { rating, comment } });
      toast.success("Merci pour ton avis !");
      onSaved();
    } catch (err) {
      toast.error((err as ApiError).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardBody>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-xl font-bold">Avis des apprenants</h2>
          <Rating value={course.avg_rating} count={course.review_count} />
        </div>
        {canReview && (
          <form onSubmit={save} className="mt-5 space-y-3 rounded-xl bg-slate-50 p-4">
            <p className="text-sm font-semibold">{course.my_review ? "Modifier ton avis" : "Donne ton avis sur ce cours"}</p>
            <StarInput value={rating} onChange={setRating} />
            <Textarea rows={3} placeholder="Qu'as-tu pensé de ce cours ? (facultatif)" value={comment} onChange={(e) => setComment(e.target.value)} aria-label="Commentaire" />
            <Button type="submit" size="sm" loading={saving}>
              Publier mon avis
            </Button>
          </form>
        )}
        {course.reviews.length === 0 ? (
          <p className="mt-4 text-sm text-muted">Pas encore d&apos;avis pour ce cours.</p>
        ) : (
          <ul className="mt-5 divide-y divide-line">
            {course.reviews.map((review) => (
              <li key={review.id} className="flex gap-3 py-4">
                <Avatar initials={review.user_initials} color={review.user_color} size={36} />
                <div>
                  <p className="text-sm font-semibold">
                    {review.user_name} <span className="ml-1 text-warning-500">{"★".repeat(review.rating)}</span>
                    <span className="text-slate-300">{"★".repeat(5 - review.rating)}</span>
                  </p>
                  <p className="text-xs text-muted">{formatDate(review.created_at)}</p>
                  {review.comment && <p className="mt-1.5 text-sm text-ink">{review.comment}</p>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}
