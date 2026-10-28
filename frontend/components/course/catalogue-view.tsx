"use client";

import { Search, SlidersHorizontal, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { useAuth } from "@/lib/auth";
import { withQuery } from "@/lib/api";
import { DURATIONS, LEVELS, SORTS } from "@/lib/constants";
import { formatNumber } from "@/lib/format";
import { useApi, useDebounced } from "@/lib/hooks";
import type { Category, CourseSummary, Paginated } from "@/lib/types";

import { Button } from "../ui/button";
import { Checkbox, Input, Select } from "../ui/form";
import { Modal } from "../ui/modal";
import { EmptyState, ErrorState, Pagination } from "../ui/misc";
import { CourseCard, CourseCardSkeleton } from "./course-card";

function toggle(list: string[], value: string) {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

export function CatalogueView({ title = "Catalogue des cours" }: { title?: string }) {
  const { user } = useAuth();
  const isLearner = user?.role === "learner";
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const categories = params.get("category")?.split(",").filter(Boolean) ?? [];
  const levels = params.get("level")?.split(",").filter(Boolean) ?? [];
  const durations = params.get("duration")?.split(",").filter(Boolean) ?? [];
  const sort = params.get("sort") ?? (isLearner ? "recommended" : "popular");
  const forMe = params.get("for_me") === "1";
  const page = Number(params.get("page") ?? "1") || 1;

  const [query, setQuery] = useState(params.get("q") ?? "");
  const debounced = useDebounced(query);
  const [filtersOpen, setFiltersOpen] = useState(false);

  function update(changes: Record<string, string | null>, resetPage = true) {
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    if (resetPage) next.delete("page");
    const text = next.toString();
    router.replace(text ? `${pathname}?${text}` : pathname, { scroll: false });
  }

  useEffect(() => {
    if ((params.get("q") ?? "") !== debounced) update({ q: debounced || null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced]);

  const apiUrl = withQuery("/api/courses/", {
    q: params.get("q"),
    category: categories.join(","),
    level: levels.join(","),
    duration: durations.join(","),
    sort,
    for_me: forMe ? "1" : null,
    page,
    page_size: 9,
  });
  const { data, error, isLoading, mutate } = useApi<Paginated<CourseSummary>>(apiUrl, { keepPreviousData: true });
  const { data: allCategories } = useApi<Category[]>("/api/categories/");
  const activeFilters = categories.length + levels.length + durations.length + (forMe ? 1 : 0);

  const filters = (
    <div className="space-y-6">
      <fieldset>
        <legend className="mb-3 text-sm font-semibold">Thème</legend>
        <div className="space-y-2.5">
          {(allCategories ?? []).map((category) => (
            <Checkbox
              key={category.slug}
              checked={categories.includes(category.slug)}
              onChange={() => update({ category: toggle(categories, category.slug).join(",") || null })}
              label={
                <span className="flex items-center gap-1.5">
                  {category.name}
                  <span className="text-xs text-muted">({category.course_count})</span>
                </span>
              }
            />
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend className="mb-3 text-sm font-semibold">Niveau</legend>
        <div className="space-y-2.5">
          {LEVELS.map((level) => (
            <Checkbox
              key={level.value}
              checked={levels.includes(level.value)}
              onChange={() => update({ level: toggle(levels, level.value).join(",") || null })}
              label={level.label}
            />
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend className="mb-3 text-sm font-semibold">Durée</legend>
        <div className="space-y-2.5">
          {DURATIONS.map((duration) => (
            <Checkbox
              key={duration.value}
              checked={durations.includes(duration.value)}
              onChange={() => update({ duration: toggle(durations, duration.value).join(",") || null })}
              label={duration.label}
            />
          ))}
        </div>
      </fieldset>
      {isLearner && (
        <fieldset>
          <legend className="mb-3 text-sm font-semibold">Affichage</legend>
          <Checkbox checked={forMe} onChange={(checked) => update({ for_me: checked ? "1" : null })} label="Seulement « Pour toi »" />
        </fieldset>
      )}
      {activeFilters > 0 && (
        <Button variant="ghost" size="sm" icon={<X className="size-4" />} onClick={() => update({ category: null, level: null, duration: null, for_me: null })}>
          Effacer les filtres
        </Button>
      )}
    </div>
  );

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight sm:text-[28px]">{title}</h1>
        <p className="mt-1 text-[15px] text-muted">
          {data ? `${formatNumber(data.count)} cours` : "Chargement…"}
          {isLearner && " · Les cours marqués « Pour toi » sont choisis par le système de recommandation selon ton profil."}
        </p>
      </div>

      <div className="mb-6 flex flex-col gap-3 sm:flex-row">
        <Input
          containerClassName="flex-1"
          icon={<Search className="size-[18px]" />}
          placeholder="Rechercher un cours, une compétence, un formateur…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          aria-label="Rechercher un cours"
        />
        <div className="flex gap-3">
          <Select
            containerClassName="flex-1 sm:w-64"
            aria-label="Trier"
            value={sort}
            onChange={(event) => update({ sort: event.target.value })}
            options={SORTS.filter((s) => !s.learnerOnly || isLearner).map((s) => ({ value: s.value, label: `Trier : ${s.label}` }))}
          />
          <Button variant="secondary" className="h-11 lg:hidden" icon={<SlidersHorizontal className="size-4" />} onClick={() => setFiltersOpen(true)}>
            Filtres{activeFilters ? ` (${activeFilters})` : ""}
          </Button>
        </div>
      </div>

      <div className="flex gap-8">
        <aside className="hidden w-60 shrink-0 lg:block">
          <div className="sticky top-24 rounded-2xl border border-line bg-white p-5">
            <p className="mb-5 font-bold">Filtres</p>
            {filters}
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          {error ? (
            <ErrorState message={error.message} onRetry={() => mutate()} />
          ) : isLoading && !data ? (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }, (_, i) => (
                <CourseCardSkeleton key={i} />
              ))}
            </div>
          ) : !data?.results.length ? (
            <EmptyState
              title="Aucun cours ne correspond à ta recherche"
              description="Essaie avec d'autres mots-clés ou retire quelques filtres."
              action={
                <Button variant="secondary" onClick={() => { setQuery(""); update({ q: null, category: null, level: null, duration: null, for_me: null }); }}>
                  Tout afficher
                </Button>
              }
            />
          ) : (
            <>
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {data.results.map((course) => (
                  <CourseCard key={course.id} course={course} />
                ))}
              </div>
              <Pagination className="mt-8 justify-center" page={data.page} totalPages={data.total_pages} onChange={(p) => update({ page: String(p) }, false)} />
            </>
          )}
        </div>
      </div>

      <Modal
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        title="Filtres"
        footer={<Button onClick={() => setFiltersOpen(false)}>Voir les {data ? formatNumber(data.count) : ""} cours</Button>}
      >
        {filters}
      </Modal>
    </div>
  );
}
