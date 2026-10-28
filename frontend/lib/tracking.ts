/**
 * Collecte des événements d'apprentissage côté navigateur.
 *
 * Les événements sont regroupés puis envoyés par lots à /api/events/ toutes les
 * quelques secondes (et quand l'onglet est masqué), pour limiter le nombre de requêtes.
 */
import { api } from "./api";

export type TrackedEvent = {
  event_type:
    | "course_view"
    | "lesson_open"
    | "lesson_time"
    | "video_play"
    | "video_pause"
    | "video_seek"
    | "video_progress"
    | "video_complete"
    | "quiz_start"
    | "hint_used"
    | "search"
    | "recommendation_click";
  course?: number | null;
  lesson?: number | null;
  value?: number | null;
  metadata?: Record<string, unknown>;
};

type Listener = (event: TrackedEvent & { at: string }) => void;

const queue: (TrackedEvent & { session_id: string })[] = [];
const listeners = new Set<Listener>();
let timer: ReturnType<typeof setTimeout> | null = null;
let installed = false;

function sessionId(): string {
  try {
    const existing = sessionStorage.getItem("ld_session");
    if (existing) return existing;
    const id = crypto.randomUUID ? crypto.randomUUID() : String(Date.now());
    sessionStorage.setItem("ld_session", id);
    return id;
  } catch {
    return "sans-session";
  }
}

async function flush(keepalive = false) {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  if (!queue.length) return;
  const batch = queue.splice(0, 50);
  try {
    await api("/api/events/", { method: "POST", body: { events: batch }, keepalive });
  } catch {
    // La collecte ne doit jamais gêner l'apprenant : en cas d'échec, les événements sont perdus.
  }
  if (queue.length) void flush(keepalive);
}

function install() {
  if (installed || typeof window === "undefined") return;
  installed = true;
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") void flush(true);
  });
  window.addEventListener("pagehide", () => void flush(true));
}

export function track(event: TrackedEvent) {
  if (typeof window === "undefined") return;
  install();
  queue.push({ ...event, session_id: sessionId() });
  listeners.forEach((listener) => listener({ ...event, at: new Date().toISOString() }));
  if (queue.length >= 10) void flush();
  else if (!timer) timer = setTimeout(() => void flush(), 4000);
}

export function flushEvents() {
  return flush();
}

/** Permet d'afficher en direct les événements collectés (panneau de démonstration). */
export function onTrack(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
