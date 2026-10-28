"use client";

import { useState } from "react";

import { api, ApiError } from "@/lib/api";
import { useApi } from "@/lib/hooks";
import type { CourseSummary, Paginated } from "@/lib/types";

import { Button } from "../ui/button";
import { Input, Select, Textarea } from "../ui/form";
import { Modal } from "../ui/modal";
import { useToast } from "../ui/toast";

export type InterventionKind = "message" | "reminder" | "course_suggestion" | "tutoring";

const KINDS: { value: InterventionKind; label: string }[] = [
  { value: "reminder", label: "Rappel personnalisé" },
  { value: "message", label: "Message libre" },
  { value: "course_suggestion", label: "Suggérer un cours" },
  { value: "tutoring", label: "Proposer un tutorat" },
];

function template(kind: InterventionKind, firstName: string, courseTitle?: string) {
  switch (kind) {
    case "reminder":
      return `Bonjour ${firstName}, tu étais bien parti${courseTitle ? ` sur « ${courseTitle} »` : ""} ! Reprends avec une leçon courte, je reste disponible si tu as des questions.`;
    case "course_suggestion":
      return `Bonjour ${firstName}, je pense que ce cours plus court pourrait t'aider à reprendre le rythme.`;
    case "tutoring":
      return `Bonjour ${firstName}, je te propose 15 minutes d'échange pour comprendre ce qui te bloque et t'aider à avancer.`;
    default:
      return `Bonjour ${firstName}, `;
  }
}

function defaultDate() {
  const date = new Date(Date.now() + 2 * 24 * 3600 * 1000);
  date.setHours(17, 0, 0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Fenêtre « Contacter un apprenant » : crée une intervention (notification + e-mail). */
export function ContactModal({
  open,
  onClose,
  learner,
  course,
  initialKind = "reminder",
  suggestedCourseId,
  onSent,
}: {
  open: boolean;
  onClose: () => void;
  learner: { id: number; name: string };
  course?: { id: number; title: string } | null;
  initialKind?: InterventionKind;
  suggestedCourseId?: number;
  onSent?: () => void;
}) {
  const toast = useToast();
  const firstName = learner.name.split(" ")[0];
  const [kind, setKind] = useState<InterventionKind>(initialKind);
  const [message, setMessage] = useState(template(initialKind, firstName, course?.title));
  const [suggested, setSuggested] = useState<string>(suggestedCourseId ? String(suggestedCourseId) : "");
  const [date, setDate] = useState(defaultDate());
  const [error, setError] = useState<ApiError | null>(null);
  const [sending, setSending] = useState(false);
  const { data: courses } = useApi<Paginated<CourseSummary>>(open && kind === "course_suggestion" ? "/api/courses/?page_size=100&sort=title" : null);

  function changeKind(value: InterventionKind) {
    setKind(value);
    setMessage(template(value, firstName, course?.title));
    setError(null);
  }

  async function send() {
    setSending(true);
    setError(null);
    try {
      await api(`/api/instructor/learners/${learner.id}/interventions/`, {
        method: "POST",
        body: {
          kind,
          message,
          course: course?.id ?? null,
          suggested_course: kind === "course_suggestion" && suggested ? Number(suggested) : null,
          scheduled_for: kind === "tutoring" ? new Date(date).toISOString() : null,
        },
      });
      toast.success(`Message envoyé à ${learner.name}.`);
      onSent?.();
      onClose();
    } catch (err) {
      setError(err as ApiError);
    } finally {
      setSending(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Contacter ${learner.name}`}
      description="L'apprenant reçoit une notification sur la plateforme et un e-mail."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button onClick={send} loading={sending} disabled={message.trim().length < 5}>
            Envoyer
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error && !Object.keys(error.errors).length && <p className="text-sm font-medium text-danger-600">{error.message}</p>}
        <Select label="Type d'action" value={kind} onChange={(e) => changeKind(e.target.value as InterventionKind)} options={KINDS} />
        {kind === "course_suggestion" && (
          <Select
            label="Cours à suggérer"
            placeholder="Choisir un cours…"
            value={suggested}
            onChange={(e) => setSuggested(e.target.value)}
            options={(courses?.results ?? []).map((c) => ({ value: c.id, label: `${c.title} (${Math.round(c.duration_minutes / 60)} h)` }))}
            error={error?.field("suggested_course")}
          />
        )}
        {kind === "tutoring" && (
          <Input label="Date et heure du tutorat" type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} error={error?.field("scheduled_for")} />
        )}
        <Textarea label="Message" rows={5} value={message} onChange={(e) => setMessage(e.target.value)} error={error?.field("message")} />
      </div>
    </Modal>
  );
}
