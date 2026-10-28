"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Input, Select, Toggle } from "@/components/ui/form";
import { ErrorState, PageHeader, Skeleton } from "@/components/ui/misc";
import { useToast } from "@/components/ui/toast";
import { api, ApiError } from "@/lib/api";
import { timeAgo } from "@/lib/format";
import { useApi } from "@/lib/hooks";
import type { PlatformSettings } from "@/lib/types";

const RECOMMENDERS = [
  { value: "hybrid", label: "Hybride (recommandé)" },
  { value: "collaborative", label: "Filtrage collaboratif" },
  { value: "content", label: "Embeddings de contenu" },
  { value: "popularity", label: "Popularité (référence)" },
];
const SCHEDULES = [
  { value: "Chaque nuit à 02:00", label: "Chaque nuit à 02:00" },
  { value: "Chaque semaine (lundi 02:00)", label: "Chaque semaine (lundi 02:00)" },
  { value: "Manuellement", label: "Manuellement uniquement" },
];
const LANGUAGES = [
  { value: "Français", label: "Français" },
  { value: "English", label: "Anglais" },
];

type Draft = Omit<PlatformSettings, "updated_at">;

function SettingsForm({ initial, onSaved }: { initial: PlatformSettings; onSaved: (s: PlatformSettings) => void }) {
  const toast = useToast();
  const [values, setValues] = useState<Draft>(initial);
  const [error, setError] = useState<ApiError | null>(null);
  const [saving, setSaving] = useState(false);
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setValues((v) => ({ ...v, [key]: value }));
  const dirty = (Object.keys(values) as (keyof Draft)[]).some((k) => values[k] !== initial[k]);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const saved = await api<PlatformSettings>("/api/admin/settings/", { method: "PUT", body: values });
      toast.success("Paramètres enregistrés.");
      onSaved(saved);
    } catch (err) {
      setError(err as ApiError);
      toast.error((err as ApiError).message);
    } finally {
      setSaving(false);
    }
  }

  const percent = (value: number) => Math.round(value * 100);

  return (
    <form onSubmit={save} className="space-y-6" noValidate>
      <Card>
        <CardBody>
          <CardHeader title="Général" />
          <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input label="Nom de la plateforme" required value={values.platform_name} onChange={(e) => set("platform_name", e.target.value)} error={error?.field("platform_name")} />
            <Input label="E-mail de contact" type="email" required value={values.contact_email} onChange={(e) => set("contact_email", e.target.value)} error={error?.field("contact_email")} />
            <Select label="Langue par défaut" value={values.default_language} onChange={(e) => set("default_language", e.target.value)} options={LANGUAGES} error={error?.field("default_language")} />
            <Input label="Fuseau horaire" value={values.timezone} onChange={(e) => set("timezone", e.target.value)} error={error?.field("timezone")} hint="Format IANA, ex. Africa/Ouagadougou" />
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          <CardHeader title="Modèles et recommandations" subtitle="Ces réglages s'appliquent dès l'enregistrement, sans réentraîner les modèles." />
          <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Select label="Système de recommandation actif" value={values.active_recommender} onChange={(e) => set("active_recommender", e.target.value as Draft["active_recommender"])} options={RECOMMENDERS} error={error?.field("active_recommender")} />
            <Input label="Nombre de recommandations par apprenant" type="number" min={3} max={30} value={values.recommendations_count} onChange={(e) => set("recommendations_count", Number(e.target.value))} error={error?.field("recommendations_count")} />
            <Select label="Fréquence d'entraînement" value={values.training_schedule} onChange={(e) => set("training_schedule", e.target.value)} options={SCHEDULES.some((o) => o.value === values.training_schedule) ? SCHEDULES : [{ value: values.training_schedule, label: values.training_schedule }, ...SCHEDULES]} error={error?.field("training_schedule")} hint="À reporter dans la tâche planifiée (cron) qui lance train_models." />
            <Input label="Inactivité avant relance (jours)" type="number" min={1} max={60} value={values.inactivity_days} onChange={(e) => set("inactivity_days", Number(e.target.value))} error={error?.field("inactivity_days")} />
          </div>
          <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div>
              <label htmlFor="risk-high" className="flex justify-between text-[13px] font-medium">
                <span>Seuil de risque élevé</span>
                <span className="font-semibold text-danger-600">{percent(values.risk_threshold)} %</span>
              </label>
              <input id="risk-high" type="range" min={50} max={95} step={1} value={percent(values.risk_threshold)} onChange={(e) => set("risk_threshold", Number(e.target.value) / 100)} className="mt-2 w-full accent-danger-600" />
              {error?.field("risk_threshold") && <p className="mt-1 text-xs text-danger-600">{error.field("risk_threshold")}</p>}
              <p className="mt-1 text-xs text-muted">Au-dessus : l&apos;apprenant est signalé en rouge au formateur.</p>
            </div>
            <div>
              <label htmlFor="risk-medium" className="flex justify-between text-[13px] font-medium">
                <span>Seuil de risque moyen</span>
                <span className="font-semibold text-warning-700">{percent(values.medium_risk_threshold)} %</span>
              </label>
              <input id="risk-medium" type="range" min={20} max={90} step={1} value={percent(values.medium_risk_threshold)} onChange={(e) => set("medium_risk_threshold", Number(e.target.value) / 100)} className="mt-2 w-full accent-warning-500" />
              {error?.field("medium_risk_threshold") && <p className="mt-1 text-xs text-danger-600">{error.field("medium_risk_threshold")}</p>}
              <p className="mt-1 text-xs text-muted">Doit rester inférieur au seuil élevé.</p>
            </div>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          <CardHeader title="Notifications par e-mail" />
          <div className="mt-4 divide-y divide-line">
            {(
              [
                ["email_inactivity_reminder", "Relance des apprenants inactifs", "Un e-mail est envoyé après la durée d'inactivité définie ci-dessus."],
                ["email_instructor_alert", "Alerte au formateur", "Le formateur est prévenu quand un apprenant passe en risque élevé."],
                ["email_weekly_digest", "Résumé hebdomadaire", "Chaque lundi, un récapitulatif de progression pour les apprenants."],
                ["email_completion_congrats", "Félicitations de fin de cours", "Envoyé avec le lien du certificat."],
              ] as const
            ).map(([key, label, help]) => (
              <div key={key} className="flex items-center justify-between gap-4 py-3.5">
                <div>
                  <p className="text-sm font-medium">{label}</p>
                  <p className="text-xs text-muted">{help}</p>
                </div>
                <Toggle checked={values[key]} onChange={(checked) => set(key, checked)} label={label} />
              </div>
            ))}
          </div>
        </CardBody>
      </Card>

      <div className="sticky bottom-0 -mx-4 flex items-center justify-end gap-3 border-t border-line bg-canvas/90 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-xl sm:border">
        {dirty && <span className="mr-auto text-sm text-muted">Modifications non enregistrées</span>}
        <Button variant="secondary" disabled={!dirty || saving} onClick={() => { setValues(initial); setError(null); }}>
          Annuler
        </Button>
        <Button type="submit" loading={saving} disabled={!dirty}>
          Enregistrer
        </Button>
      </div>
    </form>
  );
}

export default function SettingsPage() {
  const { data, error, isLoading, mutate } = useApi<PlatformSettings>("/api/admin/settings/");
  if (error) return <ErrorState message={error.message} onRetry={() => mutate()} />;
  return (
    <>
      <PageHeader title="Paramètres de la plateforme" subtitle={data ? `Dernière modification ${timeAgo(data.updated_at)}` : undefined} />
      {isLoading || !data ? (
        <div className="space-y-6">
          <Skeleton className="h-56 rounded-2xl" />
          <Skeleton className="h-72 rounded-2xl" />
        </div>
      ) : (
        <div className="max-w-4xl">
          <SettingsForm key={data.updated_at} initial={data} onSaved={(saved) => mutate(saved, { revalidate: false })} />
        </div>
      )}
    </>
  );
}
