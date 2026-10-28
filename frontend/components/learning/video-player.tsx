"use client";

import { useEffect, useRef } from "react";

import { track } from "@/lib/tracking";

const PROGRESS_EVERY = 20; // secondes de visionnage entre deux envois « video_progress »

/** Lecteur vidéo HTML5 qui enregistre les actions de l'apprenant (lecture, pause, retour, progression). */
export function VideoPlayer({
  src,
  courseId,
  lessonId,
  startAt = 0,
  onComplete,
}: {
  src: string;
  courseId: number;
  lessonId: number;
  startAt?: number;
  onComplete?: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const state = useRef({ watched: 0, lastTime: 0, completed: false, lastSeekFrom: 0 });

  useEffect(() => {
    state.current = { watched: 0, lastTime: startAt, completed: false, lastSeekFrom: startAt };
  }, [lessonId, startAt]);

  function base(extra: Record<string, unknown> = {}) {
    const video = videoRef.current;
    const position = Math.round(video?.currentTime ?? 0);
    const duration = video?.duration && Number.isFinite(video.duration) ? video.duration : 0;
    return { position, percent: duration ? Math.round((100 * position) / duration) : 0, ...extra };
  }

  function sendProgress() {
    const seconds = Math.round(state.current.watched);
    if (seconds <= 0) return;
    state.current.watched = 0;
    track({ event_type: "video_progress", course: courseId, lesson: lessonId, value: seconds, metadata: base() });
  }

  useEffect(() => {
    return () => sendProgress();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lessonId]);

  return (
    <div className="overflow-hidden rounded-2xl bg-[#0B1220]">
      <video
        ref={videoRef}
        key={lessonId}
        src={src}
        controls
        preload="metadata"
        playsInline
        className="aspect-video w-full"
        onLoadedMetadata={(event) => {
          if (startAt > 0 && startAt < event.currentTarget.duration - 5) event.currentTarget.currentTime = startAt;
        }}
        onPlay={() => {
          state.current.lastTime = videoRef.current?.currentTime ?? 0;
          track({ event_type: "video_play", course: courseId, lesson: lessonId, metadata: base() });
        }}
        onPause={(event) => {
          if (event.currentTarget.ended) return;
          sendProgress();
          track({ event_type: "video_pause", course: courseId, lesson: lessonId, metadata: base() });
        }}
        onSeeking={() => {
          state.current.lastSeekFrom = state.current.lastTime;
        }}
        onSeeked={(event) => {
          const delta = Math.round(event.currentTarget.currentTime - state.current.lastSeekFrom);
          state.current.lastTime = event.currentTarget.currentTime;
          if (Math.abs(delta) >= 2) track({ event_type: "video_seek", course: courseId, lesson: lessonId, value: delta, metadata: base() });
        }}
        onTimeUpdate={(event) => {
          const now = event.currentTarget.currentTime;
          const step = now - state.current.lastTime;
          if (step > 0 && step < 2) state.current.watched += step; // ignore les sauts (seek)
          state.current.lastTime = now;
          if (state.current.watched >= PROGRESS_EVERY) sendProgress();
        }}
        onEnded={() => {
          sendProgress();
          if (!state.current.completed) {
            state.current.completed = true;
            track({ event_type: "video_complete", course: courseId, lesson: lessonId, metadata: base() });
            onComplete?.();
          }
        }}
      >
        Ton navigateur ne peut pas lire cette vidéo.
      </video>
    </div>
  );
}
