"use client";

import { CircleAlert, CircleCheck, Eye, Send, ShieldCheck, Trash2 } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

import { CourseForm, type CourseFormValues } from "@/components/course/course-form";
import { ProgramEditor } from "@/components/course/program-editor";
import { Badge } from "@/components/ui/badge";
import { Button, LinkButton } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/modal";
import { ErrorState, Tabs } from "@/components/ui/misc";
import { PageLoader } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/toast";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/cn";
import { COURSE_STATUS_TONE } from "@/lib/constants";
import { formatDuration, formatNumber } from "@/lib/format";
import { useApi } from "@/lib/hooks";
import type { InstructorCourseDetail } from "@/lib/types";

type Tab = "infos" | "programme" | "verifications";

function CourseEditor() {
  const { id } = useParams<{ id: string }>();
  const params = useSearchParams();
  const router = useRouter();
  const toast = useToast();
  const { user } = useAuth();
  const initialTab = (params.get("onglet") as Tab) || "infos";
  const [tab, setTab] = useState<Tab>(["infos", "programme", "verifications"].includes(initialTab) ? initialTab : "infos");
  const { data: course, error, isLoading, mutate } = useApi<InstructorCourseDetail>(`/api/instructor/courses/${id}/`);
  const [formError, setFormError] = useState<ApiError | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState<"submit" | "delete" | "publish" | null>(null);
  const [busy, setBusy] = useState(false);

  if (isLoading) return <PageLoader />;
  if (error || !course) return <ErrorState message={error?.status === 404 ? "Ce cours n'existe pas ou ne t'appartient pas." : error?.message} onRetry={() => mutate()} />;

  const failed = course.checklist.filter((c) => !c.ok);
  const canSubmit = ["draft", "changes_requested", "rejected"].includes(course.status);
  const isAdmin = user?.role === "admin";

  async function saveInfos(values: CourseFormValues) {
    setSaving(true);
    setFormError(null);
    try {
      await api(`/api/instructor/courses/${id}/`, { method: "PUT", body: values });
      toast.success("Informations enregistrées.");
      await mutate();
    } catch (err) {
      setFormError(err as ApiError);
    } finally {
      setSaving(false);
    }
  }

  async function act(kind: "submit" | "delete" | "publish") {
    setBusy(true);
    try {
      if (kind === "submit") {
        await api(`/api/instructor/courses/${id}/submit/`, { method: "POST" });
        toast.success("Cours envoyé pour validation. Un administrateur va le relire.");
        await mutate();
      } else if (kind === "publish") {
        await api(`/api/admin/course-reviews/${id}/`, { method: "POST", body: { decision: "approve", comment: "" } });
        toast.success("Cours publié.");
        await mutate();
      } else {
        await api(`/api/instructor/courses/${id}/`, { method: "DELETE" });
        toast.success("Cours supprimé.");
        router.push("/formateur/cours");
        return;
      }
    } catch (err) {
      toast.error((err as ApiError).message);
    } finally {
      setBusy(false);
      setConfirm(null);
    }
  }

  const initialValues: CourseFormValues = {
    title: course.title,
    subtitle: course.subtitle,
    description: course.description,
    category: course.category.id,
    level: course.level,
    tags: course.tags,
    learning_outcomes: course.learning_outcomes.length ? course.learning_outcomes : [""],
    prerequisites: course.prerequisites,
    cover_color: course.cover_color,
  };

  return (
    <>
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0">
          <Link href="/formateur/cours" className="text-[13px] text-muted hover:text-ink">
            ← Gestion des cours
          </Link>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight sm:text-[28px]">{course.title}</h1>
            <Badge tone={COURSE_STATUS_TONE[course.status]}>{course.status_label}</Badge>
          </div>
          <p className="mt-1 text-sm text-muted">
            {course.modules.length} modules · {course.lesson_count} leçons · {formatDuration(course.duration_minutes)}
            {course.status === "published" && ` · ${formatNumber(course.enrolled_count)} inscrits`}
            {isAdmin && ` · par ${course.instructor.full_name}`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <LinkButton href={`/cours/${course.slug}`} variant="secondary" icon={<Eye className="size-4" />}>
            Aperçu
          </LinkButton>
          {canSubmit && !isAdmin && (
            <Button icon={<Send className="size-4" />} onClick={() => setConfirm("submit")}>
              Soumettre pour validation
            </Button>
          )}
          {isAdmin && course.status !== "published" && (
            <Button icon={<ShieldCheck className="size-4" />} onClick={() => setConfirm("publish")}>
              Publier
            </Button>
          )}
          {course.enrolled_count === 0 && (
            <Button variant="danger-ghost" aria-label="Supprimer le cours" onClick={() => setConfirm("delete")}>
              <Trash2 className="size-4" />
            </Button>
          )}
        </div>
      </div>

      {course.review_comment && ["changes_requested", "rejected"].includes(course.status) && (
        <Card className="mb-6 border-warning-500/30 bg-warning-50 p-4 text-sm">
          <p className="font-semibold">Commentaire de l&apos;administrateur</p>
          <p className="mt-1">{course.review_comment}</p>
        </Card>
      )}
      {course.status === "pending" && (
        <Card className="mb-6 bg-brand-50 p-4 text-sm text-brand-800">Ce cours est en cours de validation par un administrateur. Tu peux encore le modifier.</Card>
      )}

      <Tabs
        className="mb-6"
        value={tab}
        onChange={setTab}
        tabs={[
          { value: "infos", label: "Informations" },
          { value: "programme", label: `Programme (${course.modules.length})` },
          { value: "verifications", label: failed.length ? `Vérifications (${failed.length} à corriger)` : "Vérifications ✓" },
        ]}
      />

      {tab === "infos" && (
        <Card className="max-w-3xl">
          <CardBody>
            <CourseForm key={course.updated_at} initial={initialValues} onSubmit={saveInfos} submitLabel="Enregistrer les modifications" error={formError} saving={saving} />
          </CardBody>
        </Card>
      )}
      {tab === "programme" && <ProgramEditor course={course} onChange={() => mutate()} />}
      {tab === "verifications" && (
        <Card className="max-w-3xl">
          <CardBody>
            <CardHeader title="Vérification automatique" subtitle="Ces points sont contrôlés avant la publication du cours." />
            <ul className="mt-5 space-y-3">
              {course.checklist.map((item) => (
                <li key={item.key} className="flex items-start gap-3">
                  {item.ok ? <CircleCheck className="mt-0.5 size-5 text-success-600" /> : <CircleAlert className="mt-0.5 size-5 text-danger-600" />}
                  <span className={cn("text-sm", !item.ok && "text-danger-600")}>
                    {item.label}
                    {item.detail && <span className="block text-xs text-muted">{item.detail}</span>}
                  </span>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      )}

      <ConfirmDialog
        open={confirm === "submit"}
        onClose={() => setConfirm(null)}
        onConfirm={() => act("submit")}
        loading={busy}
        title="Soumettre ce cours ?"
        description={failed.length ? `Attention : ${failed.length} vérification(s) ne sont pas validées. L'administrateur risque de demander des modifications.` : "Un administrateur va relire ton cours avant sa publication."}
        confirmLabel="Soumettre"
      />
      <ConfirmDialog
        open={confirm === "publish"}
        onClose={() => setConfirm(null)}
        onConfirm={() => act("publish")}
        loading={busy}
        title="Publier ce cours ?"
        description="Le cours sera immédiatement visible dans le catalogue."
        confirmLabel="Publier"
      />
      <ConfirmDialog
        open={confirm === "delete"}
        onClose={() => setConfirm(null)}
        onConfirm={() => act("delete")}
        loading={busy}
        danger
        title="Supprimer ce cours ?"
        description="Le cours, ses modules, ses leçons et ses quiz seront définitivement supprimés."
        confirmLabel="Supprimer"
      />
    </>
  );
}

export default function CourseEditorPage() {
  return (
    <Suspense fallback={<PageLoader />}>
      <CourseEditor />
    </Suspense>
  );
}
