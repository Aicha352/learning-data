"use client";

import { Download, Search } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { ContactModal } from "@/components/learning/contact-modal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/form";
import { Avatar, EmptyState, ErrorState, PageHeader, Pagination, Progress, Skeleton, Table, TD, TH } from "@/components/ui/misc";
import { RiskBadge } from "@/components/ui/risk";
import { useToast } from "@/components/ui/toast";
import { downloadFile, withQuery } from "@/lib/api";
import { formatPercent, timeAgo } from "@/lib/format";
import { useApi, useDebounced } from "@/lib/hooks";
import type { AtRiskResponse, AtRiskRow } from "@/lib/types";

const LEVELS = [
  { value: "high,medium", label: "Risque moyen et élevé" },
  { value: "high", label: "Risque élevé" },
  { value: "medium", label: "Risque moyen" },
  { value: "low", label: "Risque faible" },
  { value: "high,medium,low", label: "Tous les niveaux" },
];

const ORDERINGS = [
  { value: "-score", label: "Score décroissant" },
  { value: "score", label: "Score croissant" },
  { value: "last_activity", label: "Inactifs depuis le plus longtemps" },
  { value: "progress", label: "Progression la plus faible" },
  { value: "name", label: "Nom" },
];

export default function AtRiskPage() {
  const toast = useToast();
  const [query, setQuery] = useState("");
  const q = useDebounced(query);
  const [course, setCourse] = useState("");
  const [level, setLevel] = useState("high,medium");
  const [ordering, setOrdering] = useState("-score");
  const [page, setPage] = useState(1);
  const [contact, setContact] = useState<AtRiskRow | null>(null);
  const [exporting, setExporting] = useState(false);

  const params = { q, course, level, ordering };
  const { data, error, isLoading, mutate } = useApi<AtRiskResponse>(withQuery("/api/instructor/at-risk/", { ...params, page }), { keepPreviousData: true });
  const { data: courses } = useApi<{ id: number; title: string }[]>("/api/instructor/course-options/");

  function change(setter: (value: string) => void) {
    return (value: string) => {
      setter(value);
      setPage(1);
    };
  }

  async function exportCsv() {
    setExporting(true);
    try {
      await downloadFile(withQuery("/api/instructor/at-risk/", { ...params, export: "csv" }), "apprenants-a-risque.csv");
    } catch {
      toast.error("L'export a échoué. Réessaie.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Apprenants à risque"
        subtitle="Classés par score de risque de décrochage, mis à jour chaque nuit par le modèle."
        actions={
          <Button variant="secondary" icon={<Download className="size-4" />} onClick={exportCsv} loading={exporting}>
            Exporter (CSV)
          </Button>
        }
      />

      <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_repeat(3,minmax(0,220px))]">
        <Input icon={<Search className="size-[18px]" />} placeholder="Rechercher un apprenant…" value={query} onChange={(e) => { setQuery(e.target.value); setPage(1); }} aria-label="Rechercher un apprenant" />
        <Select aria-label="Cours" value={course} onChange={(e) => change(setCourse)(e.target.value)} options={[{ value: "", label: "Tous les cours" }, ...(courses ?? []).map((c) => ({ value: c.id, label: c.title }))]} />
        <Select aria-label="Niveau de risque" value={level} onChange={(e) => change(setLevel)(e.target.value)} options={LEVELS} />
        <Select aria-label="Trier" value={ordering} onChange={(e) => change(setOrdering)(e.target.value)} options={ORDERINGS} />
      </div>

      {data && (
        <div className="mb-5 flex flex-wrap gap-2">
          <Badge tone="danger">{data.summary.high} à risque élevé</Badge>
          <Badge tone="warning">{data.summary.medium} à risque moyen</Badge>
          <Badge tone="brand">{data.summary.contacted_this_week} contactés cette semaine</Badge>
          <Badge tone="success">{data.summary.returned_after_contact} revenus après un contact</Badge>
        </div>
      )}

      {error ? (
        <ErrorState message={error.message} onRetry={() => mutate()} />
      ) : isLoading && !data ? (
        <Skeleton className="h-96 rounded-2xl" />
      ) : !data?.results.length ? (
        <EmptyState title="Aucun apprenant ne correspond" description="Modifie les filtres ou reviens après le prochain entraînement des modèles." />
      ) : (
        <>
          <Table>
            <thead>
              <tr>
                <TH>Apprenant</TH>
                <TH>Cours</TH>
                <TH>Progression</TH>
                <TH>Dernière activité</TH>
                <TH>Risque</TH>
                <TH>Principaux signaux</TH>
                <TH className="text-right">Action</TH>
              </tr>
            </thead>
            <tbody>
              {data.results.map((row) => (
                <tr key={row.id} className="hover:bg-slate-50/70">
                  <TD>
                    <Link href={`/formateur/apprenants/${row.user.id}`} className="flex items-center gap-3">
                      <Avatar initials={row.user.initials} color={row.user.color} size={36} />
                      <span className="min-w-0">
                        <span className="block font-semibold hover:text-brand-700">{row.user.name}</span>
                        <span className="block max-w-[200px] truncate text-xs text-muted">{row.user.email}</span>
                      </span>
                    </Link>
                  </TD>
                  <TD className="max-w-[180px]">
                    <span className="line-clamp-2">{row.course.title}</span>
                  </TD>
                  <TD>
                    <div className="flex w-32 items-center gap-2">
                      <Progress value={row.progress} size="sm" tone={row.progress < 0.3 ? "danger" : "brand"} />
                      <span className="w-9 text-xs font-medium">{formatPercent(row.progress)}</span>
                    </div>
                  </TD>
                  <TD className="whitespace-nowrap">{timeAgo(row.last_activity_at)}</TD>
                  <TD>
                    <RiskBadge level={row.level} score={row.score} />
                  </TD>
                  <TD className="max-w-[220px] text-[13px] text-muted">{row.signals.join(" · ") || "—"}</TD>
                  <TD className="text-right">
                    {row.contacted_recently ? (
                      <Badge tone="success">Contacté</Badge>
                    ) : (
                      <Button variant="secondary" size="sm" onClick={() => setContact(row)}>
                        Contacter
                      </Button>
                    )}
                  </TD>
                </tr>
              ))}
            </tbody>
          </Table>
          <div className="mt-4 flex flex-col items-center justify-between gap-3 text-[13px] text-muted sm:flex-row">
            <span>
              {data.results.length} apprenants affichés sur {data.count}
            </span>
            <Pagination page={data.page} totalPages={data.total_pages} onChange={setPage} />
          </div>
        </>
      )}

      {contact && (
        <ContactModal
          open
          onClose={() => setContact(null)}
          learner={{ id: contact.user.id, name: contact.user.name }}
          course={contact.course}
          onSent={() => mutate()}
        />
      )}
    </>
  );
}
