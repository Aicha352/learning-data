"use client";

import { Download, Search } from "lucide-react";
import { useState } from "react";

import { Badge, type Tone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/form";
import { EmptyState, ErrorState, PageHeader, Pagination, Skeleton, Table, TD, TH } from "@/components/ui/misc";
import { useToast } from "@/components/ui/toast";
import { ApiError, downloadFile, withQuery } from "@/lib/api";
import { formatDateTime, formatNumber } from "@/lib/format";
import { useApi, useDebounced } from "@/lib/hooks";
import type { ActivityLogEntry, Paginated } from "@/lib/types";

const PERIODS = [
  { value: "7d", label: "7 derniers jours" },
  { value: "30d", label: "30 derniers jours" },
  { value: "90d", label: "3 derniers mois" },
  { value: "all", label: "Tout l'historique" },
];
const ACTIONS = [
  { value: "", label: "Tous les types" },
  { value: "login", label: "Connexions" },
  { value: "create", label: "Créations" },
  { value: "update", label: "Modifications" },
  { value: "delete", label: "Suppressions" },
  { value: "system", label: "Système" },
];
const ACTION_TONE: Record<ActivityLogEntry["action"], Tone> = { login: "neutral", create: "success", update: "brand", delete: "danger", system: "violet" };

export default function ActivityLogPage() {
  const toast = useToast();
  const [query, setQuery] = useState("");
  const q = useDebounced(query);
  const [period, setPeriod] = useState("7d");
  const [action, setAction] = useState("");
  const [page, setPage] = useState(1);
  const [exporting, setExporting] = useState(false);
  const filters = { q, period, action };
  const { data, error, isLoading, mutate } = useApi<Paginated<ActivityLogEntry>>(withQuery("/api/admin/activity/", { ...filters, page }), { keepPreviousData: true });

  async function exportCsv() {
    setExporting(true);
    try {
      await downloadFile(withQuery("/api/admin/activity/", { ...filters, export: "csv" }), "journal-activite.csv");
    } catch (err) {
      toast.error((err as ApiError).message ?? "Export impossible.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Journal d'activité"
        subtitle={data ? `${formatNumber(data.count)} événements` : "Connexions, créations, modifications et actions du système."}
        actions={
          <Button variant="secondary" icon={<Download className="size-4" />} onClick={exportCsv} loading={exporting}>
            Exporter en CSV
          </Button>
        }
      />
      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_200px_200px]">
        <Input icon={<Search className="size-[18px]" />} placeholder="Utilisateur, détail, adresse IP…" aria-label="Rechercher dans le journal" value={query} onChange={(e) => { setQuery(e.target.value); setPage(1); }} />
        <Select aria-label="Type d'action" value={action} onChange={(e) => { setAction(e.target.value); setPage(1); }} options={ACTIONS} />
        <Select aria-label="Période" value={period} onChange={(e) => { setPeriod(e.target.value); setPage(1); }} options={PERIODS} />
      </div>
      {error ? (
        <ErrorState message={error.message} onRetry={() => mutate()} />
      ) : isLoading && !data ? (
        <Skeleton className="h-96 rounded-2xl" />
      ) : !data?.results.length ? (
        <EmptyState title="Aucun événement" description="Élargis la période ou modifie les filtres." />
      ) : (
        <>
          <Table>
            <thead>
              <tr>
                <TH>Date</TH>
                <TH>Utilisateur</TH>
                <TH>Type</TH>
                <TH>Détail</TH>
                <TH>Adresse IP</TH>
              </tr>
            </thead>
            <tbody>
              {data.results.map((entry) => (
                <tr key={entry.id}>
                  <TD className="whitespace-nowrap text-muted tabular-nums">{formatDateTime(entry.created_at)}</TD>
                  <TD className="whitespace-nowrap font-medium">{entry.actor_label}</TD>
                  <TD>
                    <Badge tone={ACTION_TONE[entry.action]}>{entry.action_label}</Badge>
                  </TD>
                  <TD className="min-w-72">{entry.description}</TD>
                  <TD className="font-mono text-xs whitespace-nowrap text-muted">{entry.ip_address ?? "—"}</TD>
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
