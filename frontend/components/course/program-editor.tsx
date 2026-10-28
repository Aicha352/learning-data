"use client";

import { ArrowDown, ArrowUp, ClipboardList, Pencil, Plus, Trash2, Video } from "lucide-react";
import { useState } from "react";

import { api, ApiError } from "@/lib/api";
import { useApi } from "@/lib/hooks";
import type { EditorLesson, InstructorCourseDetail, QuizEditorData } from "@/lib/types";

import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { Checkbox, Input, Select, Textarea } from "../ui/form";
import { ConfirmDialog, Modal } from "../ui/modal";
import { EmptyState } from "../ui/misc";
import { PageLoader } from "../ui/spinner";
import { useToast } from "../ui/toast";

type Module = InstructorCourseDetail["modules"][number];

function IconButton({ label, onClick, children, disabled }: { label: string; onClick: () => void; children: React.ReactNode; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="rounded-lg p-1.5 text-muted transition-colors hover:bg-slate-100 hover:text-ink disabled:pointer-events-none disabled:opacity-30"
    >
      {children}
    </button>
  );
}

/* ----------------------------------------------------------------- Module */
function ModuleModal({ courseId, module, nextOrder, onClose, onSaved }: { courseId: number; module: Module | null; nextOrder: number; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [title, setTitle] = useState(module?.title ?? "");
  const [description, setDescription] = useState(module?.description ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      if (module) await api(`/api/instructor/modules/${module.id}/`, { method: "PATCH", body: { title, description } });
      else await api("/api/instructor/modules/", { method: "POST", body: { course: courseId, title, description } });
      toast.success(module ? "Module modifié." : "Module ajouté.");
      onSaved();
      onClose();
    } catch (err) {
      setError(err as ApiError);
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={module ? "Modifier le module" : `Nouveau module (n° ${nextOrder})`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button onClick={save} loading={saving} disabled={title.trim().length < 3}>
            Enregistrer
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Input label="Titre du module" required value={title} onChange={(e) => setTitle(e.target.value)} error={error?.field("title")} placeholder="Ex. : Nettoyer les données" autoFocus />
        <Input label="Description courte (facultatif)" value={description} onChange={(e) => setDescription(e.target.value)} error={error?.field("description")} />
      </div>
    </Modal>
  );
}

/* ----------------------------------------------------------------- Leçon */
function LessonModal({ moduleId, lesson, onClose, onSaved }: { moduleId: number; lesson: EditorLesson | null; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [form, setForm] = useState({
    title: lesson?.title ?? "",
    duration_minutes: lesson?.duration_minutes ?? 10,
    video_url: lesson?.video_url ?? "",
    content: lesson?.content ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const body = { ...form, module: moduleId, duration_minutes: Number(form.duration_minutes) };
      if (lesson) await api(`/api/instructor/lessons/${lesson.id}/`, { method: "PATCH", body });
      else await api("/api/instructor/lessons/", { method: "POST", body });
      toast.success(lesson ? "Leçon modifiée." : "Leçon ajoutée.");
      onSaved();
      onClose();
    } catch (err) {
      setError(err as ApiError);
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      size="lg"
      onClose={onClose}
      title={lesson ? "Modifier la leçon" : "Nouvelle leçon"}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button onClick={save} loading={saving} disabled={form.title.trim().length < 3}>
            Enregistrer
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error && !Object.keys(error.errors).length && <p className="text-sm text-danger-600">{error.message}</p>}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_150px]">
          <Input label="Titre" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} error={error?.field("title")} autoFocus />
          <Input
            label="Durée (min)"
            type="number"
            min={1}
            max={300}
            value={form.duration_minutes}
            onChange={(e) => setForm({ ...form, duration_minutes: Number(e.target.value) })}
            error={error?.field("duration_minutes")}
          />
        </div>
        <Input
          label="Lien de la vidéo (facultatif)"
          type="url"
          value={form.video_url}
          onChange={(e) => setForm({ ...form, video_url: e.target.value })}
          error={error?.field("video_url")}
          placeholder="https://…/video.mp4"
          hint="Fichier vidéo MP4 accessible en ligne. Sans vidéo, la leçon est une leçon à lire."
        />
        <Textarea
          label="Contenu de la leçon"
          rows={10}
          value={form.content}
          onChange={(e) => setForm({ ...form, content: e.target.value })}
          error={error?.field("content")}
          hint="Sépare les paragraphes par une ligne vide. Commence une ligne par « - » pour une liste, entoure le code de `backticks`."
        />
      </div>
    </Modal>
  );
}

/* ----------------------------------------------------------------- Quiz */
const emptyQuestion = (): QuizEditorData["questions"][number] => ({
  text: "",
  code: "",
  topic: "",
  hint: "",
  explanation: "",
  lesson: null,
  choices: [
    { text: "", is_correct: true },
    { text: "", is_correct: false },
  ],
});

function QuizEditor({ module, onClose, onSaved }: { module: Module; onClose: () => void; onSaved: () => void }) {
  const { data, isLoading } = useApi<QuizEditorData | null>(`/api/instructor/modules/${module.id}/quiz/`, { revalidateOnMount: true });
  if (isLoading) {
    return (
      <Modal open size="xl" onClose={onClose} title={`Quiz du module ${module.order}`}>
        <PageLoader />
      </Modal>
    );
  }
  const initial = data ?? { title: `Quiz · ${module.title}`, pass_score: 70, questions: [emptyQuestion()] };
  return <QuizForm module={module} initial={initial} onClose={onClose} onSaved={onSaved} />;
}

function QuizForm({ module, initial, onClose, onSaved }: { module: Module; initial: QuizEditorData; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [quiz, setQuiz] = useState<QuizEditorData>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  function updateQuestion(index: number, patch: Partial<QuizEditorData["questions"][number]>) {
    setQuiz((q) => ({ ...q, questions: q.questions.map((item, i) => (i === index ? { ...item, ...patch } : item)) }));
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await api(`/api/instructor/modules/${module.id}/quiz/`, { method: "PUT", body: quiz });
      toast.success("Quiz enregistré.");
      onSaved();
      onClose();
    } catch (err) {
      setError(err as ApiError);
      setSaving(false);
    }
  }

  const questionErrors = (error?.errors.questions as unknown as Record<string, unknown>[] | undefined) ?? [];

  return (
    <Modal
      open
      size="xl"
      onClose={onClose}
      title={`Quiz du module ${module.order}`}
      description="Chaque question doit avoir au moins deux réponses, dont une bonne."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button onClick={save} loading={saving}>
            Enregistrer le quiz
          </Button>
        </>
      }
    >
        <div className="space-y-5">
          {error && <p className="rounded-lg bg-danger-50 p-3 text-sm font-medium text-danger-600">{error.message}</p>}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_180px]">
            <Input label="Titre du quiz" value={quiz.title} onChange={(e) => setQuiz({ ...quiz, title: e.target.value })} />
            <Input label="Score minimum (%)" type="number" min={1} max={100} value={quiz.pass_score} onChange={(e) => setQuiz({ ...quiz, pass_score: Number(e.target.value) })} />
          </div>
          {quiz.questions.map((question, qIndex) => {
            const qError = questionErrors[qIndex] as Record<string, string[]> | undefined;
            return (
              <Card key={qIndex} className="space-y-3 bg-slate-50/70 p-4">
                <div className="flex items-center justify-between">
                  <p className="font-semibold">Question {qIndex + 1}</p>
                  <IconButton label="Supprimer la question" disabled={quiz.questions.length <= 1} onClick={() => setQuiz({ ...quiz, questions: quiz.questions.filter((_, i) => i !== qIndex) })}>
                    <Trash2 className="size-4" />
                  </IconButton>
                </div>
                <Input label="Énoncé" value={question.text} onChange={(e) => updateQuestion(qIndex, { text: e.target.value })} error={qError?.text?.[0]} />
                <Textarea label="Extrait de code (facultatif)" rows={3} className="font-mono text-[13px]" value={question.code} onChange={(e) => updateQuestion(qIndex, { code: e.target.value })} />
                <div>
                  <p className="mb-2 text-[13px] font-medium">Réponses (coche la ou les bonnes)</p>
                  <div className="space-y-2">
                    {question.choices.map((choice, cIndex) => (
                      <div key={cIndex} className="flex items-center gap-2">
                        <Checkbox
                          checked={choice.is_correct}
                          onChange={(checked) => updateQuestion(qIndex, { choices: question.choices.map((c, i) => (i === cIndex ? { ...c, is_correct: checked } : c)) })}
                          label={<span className="sr-only">Bonne réponse</span>}
                        />
                        <Input
                          containerClassName="flex-1"
                          value={choice.text}
                          onChange={(e) => updateQuestion(qIndex, { choices: question.choices.map((c, i) => (i === cIndex ? { ...c, text: e.target.value } : c)) })}
                          placeholder={`Réponse ${String.fromCharCode(65 + cIndex)}`}
                          aria-label={`Réponse ${String.fromCharCode(65 + cIndex)}`}
                        />
                        <IconButton label="Supprimer la réponse" disabled={question.choices.length <= 2} onClick={() => updateQuestion(qIndex, { choices: question.choices.filter((_, i) => i !== cIndex) })}>
                          <Trash2 className="size-4" />
                        </IconButton>
                      </div>
                    ))}
                  </div>
                  {qError?.choices && <p className="mt-1 text-xs font-medium text-danger-600">{String(qError.choices)}</p>}
                  <Button variant="ghost" size="sm" className="mt-1" icon={<Plus className="size-4" />} disabled={question.choices.length >= 6} onClick={() => updateQuestion(qIndex, { choices: [...question.choices, { text: "", is_correct: false }] })}>
                    Ajouter une réponse
                  </Button>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Input label="Notion évaluée" value={question.topic} onChange={(e) => updateQuestion(qIndex, { topic: e.target.value })} placeholder="Ex. : Valeurs manquantes" />
                  <Select
                    label="Leçon à revoir en cas d'erreur"
                    value={question.lesson ?? ""}
                    onChange={(e) => updateQuestion(qIndex, { lesson: e.target.value ? Number(e.target.value) : null })}
                    options={[{ value: "", label: "Aucune" }, ...module.lessons.map((l) => ({ value: l.id, label: l.title }))]}
                  />
                </div>
                <Input label="Indice (facultatif)" value={question.hint} onChange={(e) => updateQuestion(qIndex, { hint: e.target.value })} />
                <Input label="Explication affichée après le quiz" value={question.explanation} onChange={(e) => updateQuestion(qIndex, { explanation: e.target.value })} />
              </Card>
            );
          })}
          <Button variant="secondary" icon={<Plus className="size-4" />} onClick={() => setQuiz({ ...quiz, questions: [...quiz.questions, emptyQuestion()] })}>
            Ajouter une question
          </Button>
        </div>
    </Modal>
  );
}

/* ----------------------------------------------------------------- Programme */
type Dialog =
  | { type: "module"; module: Module | null }
  | { type: "lesson"; moduleId: number; lesson: EditorLesson | null }
  | { type: "quiz"; module: Module }
  | { type: "delete-module"; module: Module }
  | { type: "delete-lesson"; lesson: EditorLesson }
  | { type: "delete-quiz"; module: Module };

export function ProgramEditor({ course, onChange }: { course: InstructorCourseDetail; onChange: () => void }) {
  const toast = useToast();
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [busy, setBusy] = useState(false);

  async function run(action: () => Promise<unknown>, message?: string) {
    setBusy(true);
    try {
      await action();
      if (message) toast.success(message);
      onChange();
    } catch (err) {
      toast.error((err as ApiError).message);
    } finally {
      setBusy(false);
      setDialog(null);
    }
  }

  const move = (kind: "modules" | "lessons", id: number, direction: "up" | "down") =>
    run(() => api(`/api/instructor/${kind}/${id}/move/`, { method: "POST", body: { direction } }));

  return (
    <div className="space-y-4">
      {course.modules.length === 0 && <EmptyState title="Aucun module pour l'instant" description="Un cours est découpé en modules, eux-mêmes composés de leçons et d'un quiz." />}
      {course.modules.map((module, mIndex) => (
        <Card key={module.id} className="overflow-hidden">
          <div className="flex flex-wrap items-center gap-2 border-b border-line bg-slate-50 px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="font-semibold">
                Module {module.order} · {module.title}
              </p>
              {module.description && <p className="text-xs text-muted">{module.description}</p>}
            </div>
            <IconButton label="Monter le module" disabled={busy || mIndex === 0} onClick={() => move("modules", module.id, "up")}>
              <ArrowUp className="size-4" />
            </IconButton>
            <IconButton label="Descendre le module" disabled={busy || mIndex === course.modules.length - 1} onClick={() => move("modules", module.id, "down")}>
              <ArrowDown className="size-4" />
            </IconButton>
            <IconButton label="Modifier le module" onClick={() => setDialog({ type: "module", module })}>
              <Pencil className="size-4" />
            </IconButton>
            <IconButton label="Supprimer le module" onClick={() => setDialog({ type: "delete-module", module })}>
              <Trash2 className="size-4" />
            </IconButton>
          </div>
          <ul className="divide-y divide-line">
            {module.lessons.map((lesson, lIndex) => (
              <li key={lesson.id} className="flex items-center gap-2 px-4 py-2.5 text-sm">
                <span className="w-6 text-xs text-muted">{lesson.order}.</span>
                <span className="min-w-0 flex-1 truncate">{lesson.title}</span>
                {lesson.video_url && <Video className="size-4 text-muted" aria-label="Contient une vidéo" />}
                {!lesson.content.trim() && !lesson.video_url && <Badge tone="warning">Vide</Badge>}
                <span className="w-14 text-right text-xs text-muted">{lesson.duration_minutes} min</span>
                <IconButton label="Monter la leçon" disabled={busy || lIndex === 0} onClick={() => move("lessons", lesson.id, "up")}>
                  <ArrowUp className="size-4" />
                </IconButton>
                <IconButton label="Descendre la leçon" disabled={busy || lIndex === module.lessons.length - 1} onClick={() => move("lessons", lesson.id, "down")}>
                  <ArrowDown className="size-4" />
                </IconButton>
                <IconButton label="Modifier la leçon" onClick={() => setDialog({ type: "lesson", moduleId: module.id, lesson })}>
                  <Pencil className="size-4" />
                </IconButton>
                <IconButton label="Supprimer la leçon" onClick={() => setDialog({ type: "delete-lesson", lesson })}>
                  <Trash2 className="size-4" />
                </IconButton>
              </li>
            ))}
            <li className="flex flex-wrap items-center gap-2 px-4 py-2.5">
              <Button variant="ghost" size="sm" icon={<Plus className="size-4" />} onClick={() => setDialog({ type: "lesson", moduleId: module.id, lesson: null })}>
                Ajouter une leçon
              </Button>
              <span className="ml-auto flex items-center gap-2">
                {module.quiz ? (
                  <>
                    <Badge tone={module.quiz.question_count >= 2 ? "success" : "warning"} icon={<ClipboardList className="size-3.5" />}>
                      Quiz · {module.quiz.question_count} question{module.quiz.question_count > 1 ? "s" : ""}
                    </Badge>
                    <Button variant="secondary" size="sm" onClick={() => setDialog({ type: "quiz", module })}>
                      Modifier le quiz
                    </Button>
                    <IconButton label="Supprimer le quiz" onClick={() => setDialog({ type: "delete-quiz", module })}>
                      <Trash2 className="size-4" />
                    </IconButton>
                  </>
                ) : (
                  <Button variant="subtle" size="sm" icon={<ClipboardList className="size-4" />} onClick={() => setDialog({ type: "quiz", module })}>
                    Créer le quiz
                  </Button>
                )}
              </span>
            </li>
          </ul>
        </Card>
      ))}
      <Button variant="secondary" icon={<Plus className="size-4" />} onClick={() => setDialog({ type: "module", module: null })}>
        Ajouter un module
      </Button>

      {dialog?.type === "module" && (
        <ModuleModal courseId={course.id} module={dialog.module} nextOrder={course.modules.length + 1} onClose={() => setDialog(null)} onSaved={onChange} />
      )}
      {dialog?.type === "lesson" && <LessonModal moduleId={dialog.moduleId} lesson={dialog.lesson} onClose={() => setDialog(null)} onSaved={onChange} />}
      {dialog?.type === "quiz" && <QuizEditor module={dialog.module} onClose={() => setDialog(null)} onSaved={onChange} />}
      {dialog?.type === "delete-module" && (
        <ConfirmDialog
          open
          danger
          loading={busy}
          onClose={() => setDialog(null)}
          onConfirm={() => run(() => api(`/api/instructor/modules/${dialog.module.id}/`, { method: "DELETE" }), "Module supprimé.")}
          title="Supprimer ce module ?"
          description={`« ${dialog.module.title} », ses ${dialog.module.lessons.length} leçons et son quiz seront définitivement supprimés.`}
          confirmLabel="Supprimer"
        />
      )}
      {dialog?.type === "delete-lesson" && (
        <ConfirmDialog
          open
          danger
          loading={busy}
          onClose={() => setDialog(null)}
          onConfirm={() => run(() => api(`/api/instructor/lessons/${dialog.lesson.id}/`, { method: "DELETE" }), "Leçon supprimée.")}
          title="Supprimer cette leçon ?"
          description={`« ${dialog.lesson.title} » sera définitivement supprimée.`}
          confirmLabel="Supprimer"
        />
      )}
      {dialog?.type === "delete-quiz" && (
        <ConfirmDialog
          open
          danger
          loading={busy}
          onClose={() => setDialog(null)}
          onConfirm={() => run(() => api(`/api/instructor/modules/${dialog.module.id}/quiz/`, { method: "DELETE" }), "Quiz supprimé.")}
          title="Supprimer ce quiz ?"
          description="Les questions et les résultats associés seront supprimés."
          confirmLabel="Supprimer"
        />
      )}
    </div>
  );
}
