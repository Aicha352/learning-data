"use client";

import { ClipboardCheck } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { CourseCover } from "@/components/course/course-visuals";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { Avatar, EmptyState, ErrorState, PageHeader, Skeleton, Table, TD, TH, Tabs } from "@/components/ui/misc";
import { withQuery } from "@/lib/api";
import { COURSE_STATUS_TONE } from "@/lib/constants";
import { formatDuration, timeAgo } from "@/lib/format";
import { useApi } from "@/lib/hooks";
import type { InstructorCourse } from "@/lib/types";

type Filter = "pending" | "changes_requested" | "rejected" | "published" | "all";

const FILTERS: { value: Filter; label: string }[] = [
  { value: "pending", label: "À valider" },
  { value: "changes_requested", label: "Modifications demandées" },
  { value: "rejected", label: "Refusés" },
  { value: "published", label: "Publiés" },
  { value: "all", label: "Tous" },
];

export default function ValidationListPage() {
  const [filter, setFilter] = useState<Filter>("pending");
  const { data, error, isLoading, mutate } = useApi<InstructorCourse[]>(withQuery("/api/admin/course-reviews/", { status: filter }), { keepPreviousData: true });

  return (
    <>
      <PageHeader title="Validation des cours" subtitle="Relis les cours soumis par les formateurs avant leur publication dans le catalogue." />
      <Tabs className="mb-5" value={filter} onChange={setFilter} tabs={FILTERS} />
      {error ? (
        <ErrorState message={error.message} onRetry={() => mutate()} />
      ) : isLoading && !data ? (
        <Skeleton className="h-72 rounded-2xl" />
      ) : !data?.length ? (
        <EmptyState icon={<ClipboardCheck className="size-6" />} title={filter === "pending" ? "Aucun cours en attente" : "Aucun cours dans cette catégorie"} description={filter === "pending" ? "Tout est à jour. Les nouveaux cours soumis apparaîtront ici." : undefined} />
      ) : (
        <Table>
          <thead>
            <tr>
              <TH>Cours</TH>
              <TH>Formateur</TH>
              <TH>Contenu</TH>
              <TH>Statut</TH>
              <TH>Soumis</TH>
              <TH>
                <span className="sr-only">Action</span>
              </TH>
            </tr>
          </thead>
          <tbody>
            {data.map((course) => (
              <tr key={course.id} className="hover:bg-slate-50/70">
                <TD>
                  <Link href={`/admin/validation/${course.id}`} className="flex items-center gap-3">
                    <CourseCover color={course.cover_color} categorySlug={course.category.slug} accent={course.category.color} className="size-10 shrink-0 rounded-lg" iconSize={18} />
                    <span className="min-w-0">
                      <span className="line-clamp-1 font-semibold hover:text-brand-700">{course.title}</span>
                      <span className="text-xs text-muted">
                        {course.category.name} · {course.level_label}
                      </span>
                    </span>
                  </Link>
                </TD>
                <TD>
                  <span className="flex items-center gap-2 whitespace-nowrap">
                    <Avatar initials={course.instructor.initials} color={course.instructor.avatar_color} size={28} />
                    {course.instructor.full_name}
                  </span>
                </TD>
                <TD className="whitespace-nowrap text-muted">
                  {course.lesson_count} leçons · {formatDuration(course.duration_minutes)}
                </TD>
                <TD>
                  <Badge tone={COURSE_STATUS_TONE[course.status]}>{course.status_label}</Badge>
                </TD>
                <TD className="whitespace-nowrap text-muted">{course.submitted_at ? timeAgo(course.submitted_at) : "—"}</TD>
                <TD className="text-right">
                  <LinkButton href={`/admin/validation/${course.id}`} size="sm" variant={course.status === "pending" ? "primary" : "secondary"}>
                    {course.status === "pending" ? "Examiner" : "Voir"}
                  </LinkButton>
                </TD>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </>
  );
}
