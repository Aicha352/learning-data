"use client";

import { Plus, Search } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { CourseCover } from "@/components/course/course-visuals";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/form";
import { EmptyState, ErrorState, PageHeader, Pagination, Progress, Skeleton, Table, TD, TH } from "@/components/ui/misc";
import { useAuth } from "@/lib/auth";
import { withQuery } from "@/lib/api";
import { COURSE_STATUS_TONE } from "@/lib/constants";
import { formatNumber, formatPercent, timeAgo } from "@/lib/format";
import { useApi, useDebounced } from "@/lib/hooks";
import type { InstructorCourse, Paginated } from "@/lib/types";

const STATUSES = [
  { value: "", label: "Tous les statuts" },
  { value: "published", label: "Publiés" },
  { value: "pending", label: "En attente de validation" },
  { value: "draft", label: "Brouillons" },
  { value: "changes_requested", label: "Modifications demandées" },
  { value: "rejected", label: "Refusés" },
];

export default function InstructorCoursesPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [query, setQuery] = useState("");
  const search = useDebounced(query);
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const { data, error, isLoading, mutate } = useApi<Paginated<InstructorCourse>>(withQuery("/api/instructor/courses/", { search, status, page, page_size: 15 }), { keepPreviousData: true });

  return (
    <>
      <PageHeader
        title={isAdmin ? "Tous les cours" : "Gestion des cours"}
        subtitle={data ? `${formatNumber(data.count)} cours` : undefined}
        actions={
          <LinkButton href="/formateur/cours/nouveau" icon={<Plus className="size-4" />}>
            Nouveau cours
          </LinkButton>
        }
      />
      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_260px]">
        <Input icon={<Search className="size-[18px]" />} placeholder="Rechercher un cours…" value={query} onChange={(e) => { setQuery(e.target.value); setPage(1); }} aria-label="Rechercher un cours" />
        <Select aria-label="Statut" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} options={STATUSES} />
      </div>
      {error ? (
        <ErrorState message={error.message} onRetry={() => mutate()} />
      ) : isLoading && !data ? (
        <Skeleton className="h-96 rounded-2xl" />
      ) : !data?.results.length ? (
        <EmptyState
          title={query || status ? "Aucun cours ne correspond" : "Tu n'as pas encore de cours"}
          description="Crée ton premier cours : informations, modules, leçons et quiz."
          action={<LinkButton href="/formateur/cours/nouveau">Créer un cours</LinkButton>}
        />
      ) : (
        <>
          <Table>
            <thead>
              <tr>
                <TH>Cours</TH>
                {isAdmin && <TH>Formateur</TH>}
                <TH>Statut</TH>
                <TH>Inscrits</TH>
                <TH>Complétion</TH>
                <TH>Note</TH>
                <TH>Modifié</TH>
              </tr>
            </thead>
            <tbody>
              {data.results.map((course) => (
                <tr key={course.id} className="hover:bg-slate-50/70">
                  <TD>
                    <Link href={`/formateur/cours/${course.id}`} className="flex items-center gap-3">
                      <CourseCover color={course.cover_color} categorySlug={course.category.slug} accent={course.category.color} className="size-10 shrink-0 rounded-lg" iconSize={18} />
                      <span className="min-w-0">
                        <span className="line-clamp-1 font-semibold hover:text-brand-700">{course.title}</span>
                        <span className="text-xs text-muted">
                          {course.category.name} · {course.lesson_count} leçons
                        </span>
                      </span>
                    </Link>
                  </TD>
                  {isAdmin && <TD className="whitespace-nowrap text-muted">{course.instructor.full_name}</TD>}
                  <TD>
                    <Badge tone={COURSE_STATUS_TONE[course.status]}>{course.status_label}</Badge>
                  </TD>
                  <TD>{course.status === "published" ? formatNumber(course.enrolled_count) : "—"}</TD>
                  <TD>
                    {course.completion_rate !== null ? (
                      <div className="flex w-28 items-center gap-2">
                        <Progress value={course.completion_rate} size="sm" />
                        <span className="text-xs">{formatPercent(course.completion_rate)}</span>
                      </div>
                    ) : (
                      "—"
                    )}
                  </TD>
                  <TD>{course.avg_rating ? formatNumber(course.avg_rating, 1) : "—"}</TD>
                  <TD className="whitespace-nowrap text-muted">{timeAgo(course.updated_at)}</TD>
                </tr>
              ))}
            </tbody>
          </Table>
          <Pagination className="mt-5 justify-center" page={data.page} totalPages={data.total_pages} onChange={setPage} />
        </>
      )}
    </>
  );
}
