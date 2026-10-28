import { Clock, PlayCircle } from "lucide-react";
import Link from "next/link";

import { cn } from "@/lib/cn";
import { formatDuration } from "@/lib/format";
import type { CourseSummary } from "@/lib/types";

import { Badge } from "../ui/badge";
import { CourseCover, MatchBadge, Rating } from "./course-visuals";

export function CourseCard({
  course,
  className,
  onClick,
  footer,
}: {
  course: CourseSummary;
  className?: string;
  onClick?: () => void;
  footer?: React.ReactNode;
}) {
  return (
    <article className={cn("group flex flex-col overflow-hidden rounded-2xl border border-line bg-white shadow-card transition hover:-translate-y-0.5 hover:shadow-pop", className)}>
      <Link href={`/cours/${course.slug}`} onClick={onClick} className="flex flex-1 flex-col focus-visible:outline-offset-[-2px]">
        <div className="relative">
          <CourseCover color={course.cover_color} categorySlug={course.category.slug} accent={course.category.color} className="h-36" />
          <div className="absolute top-3 left-3 flex gap-1.5">
            {course.is_new && <Badge tone="dark">Nouveau</Badge>}
            {course.is_enrolled && (
              <Badge tone="brand" icon={<PlayCircle className="size-3" />}>
                Inscrit
              </Badge>
            )}
          </div>
        </div>
        <div className="flex flex-1 flex-col gap-2.5 p-4">
          <div>
            <Badge tone="brand" className="bg-brand-50/80">
              {course.category.name}
            </Badge>
          </div>
          <h3 className="line-clamp-2 text-base leading-snug font-semibold text-ink group-hover:text-brand-700">{course.title}</h3>
          <p className="flex flex-wrap items-center gap-x-1.5 text-[13px] text-muted">
            <span>{course.level_label}</span>
            <span aria-hidden="true">·</span>
            <span className="inline-flex items-center gap-1">
              <Clock className="size-3.5" aria-hidden="true" />
              {formatDuration(course.duration_minutes)}
            </span>
            <span aria-hidden="true">·</span>
            <span>{course.lesson_count} leçons</span>
          </p>
          <div className="mt-auto flex items-center justify-between gap-2 pt-1">
            <Rating value={course.avg_rating} count={course.review_count} />
            <MatchBadge score={course.match_score} />
          </div>
        </div>
      </Link>
      {footer && <div className="border-t border-line px-4 py-3">{footer}</div>}
    </article>
  );
}

export function CourseCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-white">
      <div className="h-36 animate-pulse bg-slate-100" />
      <div className="space-y-3 p-4">
        <div className="h-5 w-24 animate-pulse rounded bg-slate-100" />
        <div className="h-5 w-4/5 animate-pulse rounded bg-slate-100" />
        <div className="h-4 w-3/5 animate-pulse rounded bg-slate-100" />
      </div>
    </div>
  );
}
