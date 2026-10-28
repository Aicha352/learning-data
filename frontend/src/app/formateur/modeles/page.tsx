"use client";

import { CircleCheck, CircleX, Cpu, LoaderCircle, RefreshCw, Sparkles, Target, TriangleAlert, Users } from "lucide-react";
import { useState } from "react";

import { EmbeddingMap, SimpleBarChart } from "@/components/charts/charts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ErrorState, PageHeader, Skeleton, StatCard, Table, TD, TH } from "@/components/ui/misc";
import { useToast } from "@/components/ui/toast";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/cn";
import { formatDateTime, formatDecimal, formatNumber, formatPercent, timeAgo } from "@/lib/format";
import { useApi } from "@/lib/hooks";
import type { MLOverview, TrainingRun } from "@/lib/types";

const RECOMMENDERS = ["popularity", "content", "collaborative", "hybrid"] as const;
const SHORT_LABELS: Record<(typeof RECOMMENDERS)[number], string> = { popularity: "Popularité", content: "Contenu", collaborative: "Collaboratif", hybrid: "Hybride" };

const FEATURE_LABELS: Record<string, string> = {
  days_since_last_activity: "Jours depuis la dernière activité",
  activity_trend: "Tendance d'activité",
  minutes_14: "Minutes d'étude (14 j)",
  video_completion_rate: "Vidéos regardées en entier",
  quiz_avg_score: "Score moyen aux quiz",
  quiz_trend: "Évolution des scores",
  progress: "Progression dans le cours",
  weekly_pace: "Rythme hebdomadaire",
};

const STEP_ICON = {
  success: <CircleCheck className="size-5 text-success-600" />,
  failed: <CircleX className="size-5 text-danger-600" />,
  running: <LoaderCircle className="size-5 animate-spin text-brand-600" />,
  pending: <span className="block size-5 rounded-full border-2 border-line" />,
} as Record<string, React.ReactNode>;

function PipelineSteps({ run }: { run: TrainingRun }) {
  return (
    <ol className="grid grid-cols-1 gap-3 sm:grid-cols-5">
      {run.steps.map((step, index) => (
        <li key={step.key} className={cn("rounded-xl border p-3", step.status === "running" ? "border-brand-300 bg-brand-50" : step.status === "failed" ? "border-danger-600/30 bg-danger-50" : "border-line bg-white")}>
          <div className="flex items-center gap-2">
            {STEP_ICON[step.status] ?? STEP_ICON.pending}
            <span className="text-sm font-semibold">
              {index + 1}. {step.label}
            </span>
          </div>
          {step.detail && <p className="mt-2 text-xs leading-relaxed text-muted">{step.detail}</p>}
          {step.seconds !== undefined && <p className="mt-1 text-[11px] text-muted">{formatDecimal(step.seconds, 1)} s</p>}
        </li>
      ))}
    </ol>
  );
}

export default function ModelsPage() {
  const toast = useToast();
  const { data, error, isLoading, mutate } = useApi<MLOverview>("/api/ml/overview/");
  const [startedRunId, setStartedRunId] = useState<number | null>(null);
  const [starting, setStarting] = useState(false);

  const runningId = startedRunId ?? (data?.latest_run?.status === "running" ? data.latest_run.id : null);
  const { data: liveRun } = useApi<TrainingRun>(runningId ? `/api/ml/runs/${runningId}/` : null, {
    refreshInterval: (run) => (run && run.status !== "running" ? 0 : 1500),
    onSuccess: (run) => {
      if (run.status === "running") return;
      setStartedRunId(null);
      mutate();
      if (run.status === "success") toast.success("Entraînement terminé : les nouveaux modèles sont en production.");
      else toast.error(run.error || "L'entraînement a échoué.");
    },
  });

  async function train() {
    setStarting(true);
    try {
      const run = await api<TrainingRun>("/api/ml/train/", { method: "POST" });
      setStartedRunId(run.id);
      toast.info("Entraînement lancé. Tu peux suivre les étapes ci-dessous.");
    } catch (err) {
      toast.error((err as ApiError).message);
      mutate();
    } finally {
      setStarting(false);
    }
  }

  if (error) return <ErrorState message={error.message} onRetry={() => mutate()} />;
  if (isLoading || !data)
    return (
      <div className="space-y-5">
        <Skeleton className="h-16 w-1/2" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-36 rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-80 rounded-2xl" />
      </div>
    );

  const byKind = Object.fromEntries(data.models.map((m) => [m.kind, m]));
  const hybrid = byKind.hybrid;
  const dropout = byKind.dropout;
  const segments = byKind.segments;
  const content = byKind.content;
  const isRunning = Boolean(runningId) && liveRun?.status !== "success" && liveRun?.status !== "failed";
  const shownRun = (runningId && liveRun) || data.latest_run;

  const comparison = RECOMMENDERS.filter((k) => byKind[k]?.metrics?.ndcg_at_k !== undefined).map((k) => ({
    label: SHORT_LABELS[k],
    value: byKind[k].metrics.ndcg_at_k as number,
    title: `${byKind[k].label} — rappel@5 ${formatPercent(byKind[k].metrics.recall_at_k)}, précision@5 ${formatPercent(byKind[k].metrics.precision_at_k)}`,
  }));
  const bestIndex = comparison.reduce((best, item, i, arr) => (item.value > arr[best].value ? i : best), 0);
  const weights = (hybrid?.params?.weights ?? {}) as Record<string, number>;
  const coefficients = Object.entries((dropout?.metrics?.coefficients ?? {}) as Record<string, number>).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
  const maxCoef = Math.max(...coefficients.map(([, v]) => Math.abs(v)), 0.01);
  const cm = dropout?.metrics?.confusion_matrix as { tp: number; fp: number; tn: number; fn: number } | undefined;

  return (
    <>
      <PageHeader
        title="Modèles de machine learning"
        subtitle={
          hybrid?.trained_at ? (
            <>
              Dernier entraînement {timeAgo(hybrid.trained_at)} · {formatNumber(hybrid.metrics.n_users)} apprenants utilisés pour l&apos;évaluation
            </>
          ) : (
            "Aucun modèle entraîné pour le moment."
          )
        }
        actions={
          data.can_train ? (
            <Button icon={<RefreshCw className={cn("size-4", isRunning && "animate-spin")} />} onClick={train} loading={starting} disabled={isRunning}>
              {isRunning ? "Entraînement en cours…" : "Relancer l'entraînement"}
            </Button>
          ) : (
            <Badge tone="neutral">Entraînement réservé aux administrateurs</Badge>
          )
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={<Sparkles className="size-5" />} label="NDCG@5 du modèle hybride" value={formatDecimal(hybrid?.metrics?.ndcg_at_k)} hint={hybrid?.version ? `Version ${hybrid.version}` : undefined} />
        <StatCard icon={<Target className="size-5" />} tone="success" label="Rappel@5 (cours retrouvé dans le top 5)" value={formatPercent(hybrid?.metrics?.recall_at_k)} />
        <StatCard icon={<TriangleAlert className="size-5" />} tone="warning" label="AUC détection d'abandon" value={formatDecimal(dropout?.metrics?.auc)} hint={dropout?.metrics?.gradient_boosting_auc ? `Gradient boosting : ${formatDecimal(dropout.metrics.gradient_boosting_auc)}` : undefined} />
        <StatCard icon={<Users className="size-5" />} tone="violet" label="Profils d'apprenants (K-means)" value={formatNumber(segments?.metrics?.segments?.length ?? 0)} />
      </div>

      {shownRun && (
        <Card className="mt-6">
          <CardBody>
            <CardHeader
              title="Pipeline de données"
              subtitle={`${shownRun.status_label} · ${formatDateTime(shownRun.started_at)}${shownRun.triggered_by ? ` · par ${shownRun.triggered_by}` : shownRun.trigger === "schedule" ? " · automatique" : ""}`}
              action={shownRun.duration_seconds !== null ? <span className="text-xs text-muted">{formatDecimal(shownRun.duration_seconds, 1)} s</span> : undefined}
            />
            <div className="mt-4">
              <PipelineSteps run={shownRun} />
            </div>
            {shownRun.error && <p className="mt-3 rounded-lg bg-danger-50 p-3 text-sm text-danger-600">{shownRun.error}</p>}
          </CardBody>
        </Card>
      )}

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card>
          <CardBody>
            <CardHeader title="Comparaison des systèmes de recommandation" subtitle="NDCG@5 sur le dernier cours suivi par chaque apprenant (leave-last-out). Plus c'est haut, mieux c'est." />
            <div className="mt-4">
              <SimpleBarChart data={comparison} highlight={bestIndex} valueLabel="NDCG@5" format={(v) => formatDecimal(v)} domain={[0, 1]} height={230} />
            </div>
            {Object.keys(weights).length > 0 && (
              <div className="mt-4 rounded-xl bg-slate-50 p-4">
                <p className="text-sm font-semibold">Poids appris pour le modèle hybride</p>
                <div className="mt-3 grid grid-cols-3 gap-3 text-center">
                  {[
                    ["collaborative", "Collaboratif"],
                    ["content", "Contenu"],
                    ["profile", "Profil"],
                  ].map(([key, label]) => (
                    <div key={key}>
                      <p className="text-xl font-bold">{formatPercent(weights[key])}</p>
                      <p className="text-xs text-muted">{label}</p>
                    </div>
                  ))}
                </div>
                <p className="mt-3 text-xs text-muted">Pour un nouvel apprenant sans historique, le poids du profil et du contenu augmente automatiquement (démarrage à froid).</p>
              </div>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <CardHeader title="Carte des cours (embeddings)" subtitle={`${data.embedding_map.length} cours projetés en 2D : deux cours proches parlent de sujets proches.${content?.params?.dimension ? ` Dimension : ${content.params.dimension}.` : ""}`} />
            <div className="mt-4">{data.embedding_map.length ? <EmbeddingMap points={data.embedding_map} height={300} /> : <p className="text-sm text-muted">Aucun embedding calculé.</p>}</div>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <CardHeader title="Détection d'abandon" subtitle={`Régression logistique · ${formatNumber(dropout?.metrics?.n_train)} inscriptions d'entraînement, ${formatNumber(dropout?.metrics?.n_test)} de test`} />
            <div className="mt-4 grid grid-cols-3 gap-3 text-center">
              {[
                ["Précision", dropout?.metrics?.precision, "Parmi les alertes, part de vrais abandons"],
                ["Rappel", dropout?.metrics?.recall, "Part des abandons détectés"],
                ["F1", dropout?.metrics?.f1, "Équilibre des deux"],
              ].map(([label, value, help]) => (
                <div key={label as string} className="rounded-xl bg-slate-50 p-3" title={help as string}>
                  <p className="text-xl font-bold">{formatDecimal(value as number)}</p>
                  <p className="text-xs text-muted">{label as string}</p>
                </div>
              ))}
            </div>
            {cm && (
              <div className="mt-5">
                <p className="mb-2 text-sm font-semibold">Matrice de confusion (jeu de test)</p>
                <div className="grid grid-cols-[auto_1fr_1fr] gap-1.5 text-center text-sm">
                  <span />
                  <span className="text-xs text-muted">Prédit : continue</span>
                  <span className="text-xs text-muted">Prédit : abandon</span>
                  <span className="self-center pr-2 text-left text-xs text-muted">Réel : continue</span>
                  <span className="rounded-lg bg-success-50 py-3 font-semibold text-success-600">{cm.tn}</span>
                  <span className="rounded-lg bg-slate-100 py-3 font-semibold">{cm.fp}</span>
                  <span className="self-center pr-2 text-left text-xs text-muted">Réel : abandon</span>
                  <span className="rounded-lg bg-slate-100 py-3 font-semibold">{cm.fn}</span>
                  <span className="rounded-lg bg-success-50 py-3 font-semibold text-success-600">{cm.tp}</span>
                </div>
              </div>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <CardHeader title="Ce qui pèse dans le risque d'abandon" subtitle="Coefficients standardisés : à droite, la variable augmente le risque ; à gauche, elle le diminue." />
            <ul className="mt-4 space-y-3">
              {coefficients.map(([feature, value]) => (
                <li key={feature}>
                  <div className="flex justify-between text-sm">
                    <span>{FEATURE_LABELS[feature] ?? feature}</span>
                    <span className={cn("font-semibold tabular-nums", value > 0 ? "text-danger-600" : "text-success-600")}>
                      {value > 0 ? "+" : ""}
                      {formatDecimal(value)}
                    </span>
                  </div>
                  <div className="relative mt-1.5 h-2 rounded-full bg-slate-100">
                    <span className="absolute top-0 left-1/2 h-2 w-px bg-slate-300" />
                    <span
                      className={cn("absolute top-0 h-2 rounded-full", value > 0 ? "left-1/2 bg-danger-600" : "right-1/2 bg-success-600")}
                      style={{ width: `${(Math.abs(value) / maxCoef) * 50}%` }}
                    />
                  </div>
                </li>
              ))}
              {!coefficients.length && <p className="text-sm text-muted">Modèle non entraîné.</p>}
            </ul>
          </CardBody>
        </Card>
      </div>

      {segments?.metrics?.segments?.length > 0 && (
        <Card className="mt-6">
          <CardBody>
            <CardHeader title="Profils d'apprentissage" subtitle="Regroupement automatique (K-means) des apprenants selon leurs habitudes d'étude." />
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {(segments.metrics.segments as { name: string; count: number; share: number; description: string; centroid: Record<string, number> }[]).map((segment) => (
                <div key={segment.name} className="rounded-xl border border-line p-4">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold">{segment.name}</p>
                    <Badge tone="brand">{formatPercent(segment.share)}</Badge>
                  </div>
                  <p className="mt-2 text-sm text-muted">{segment.description}</p>
                  <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <dt className="text-muted">Apprenants</dt>
                      <dd className="font-semibold">{formatNumber(segment.count)}</dd>
                    </div>
                    <div>
                      <dt className="text-muted">Min / jour actif</dt>
                      <dd className="font-semibold">{formatNumber(segment.centroid.minutes_per_day, 1)}</dd>
                    </div>
                    <div>
                      <dt className="text-muted">Score quiz</dt>
                      <dd className="font-semibold">{formatNumber(segment.centroid.quiz_avg)} %</dd>
                    </div>
                    <div>
                      <dt className="text-muted">Part week-end</dt>
                      <dd className="font-semibold">{formatPercent(segment.centroid.weekend_share)}</dd>
                    </div>
                  </dl>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      )}

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card>
          <CardBody className="pb-2">
            <CardHeader title="Historique des versions" />
          </CardBody>
          <Table compact className="rounded-none border-0 shadow-none">
            <thead>
              <tr>
                <TH>Modèle</TH>
                <TH>Version</TH>
                <TH>Métrique</TH>
                <TH>Date</TH>
              </tr>
            </thead>
            <tbody>
              {data.history.map((v) => (
                <tr key={v.id}>
                  <TD>
                    <span className="flex items-center gap-2">
                      <Cpu className="size-4 text-muted" />
                      {v.label}
                    </span>
                  </TD>
                  <TD>
                    v{v.version} {v.is_active && <Badge tone="success">En production</Badge>}
                  </TD>
                  <TD className="tabular-nums">
                    {v.metric_name} {formatDecimal(v.main_metric)}
                  </TD>
                  <TD className="whitespace-nowrap text-muted">{formatDateTime(v.trained_at)}</TD>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
        <Card>
          <CardBody className="pb-2">
            <CardHeader title="Derniers entraînements" />
          </CardBody>
          <Table compact className="rounded-none border-0 shadow-none">
            <thead>
              <tr>
                <TH>Date</TH>
                <TH>Déclenché par</TH>
                <TH>Statut</TH>
                <TH>Durée</TH>
              </tr>
            </thead>
            <tbody>
              {data.runs.map((run) => (
                <tr key={run.id}>
                  <TD className="whitespace-nowrap">{formatDateTime(run.started_at)}</TD>
                  <TD className="text-muted">{run.triggered_by ?? (run.trigger === "schedule" ? "Planification" : "Système")}</TD>
                  <TD>
                    <Badge tone={run.status === "success" ? "success" : run.status === "failed" ? "danger" : "brand"}>{run.status_label}</Badge>
                  </TD>
                  <TD className="tabular-nums">{run.duration_seconds !== null ? `${formatDecimal(run.duration_seconds, 1)} s` : "—"}</TD>
                </tr>
              ))}
              {!data.runs.length && (
                <tr>
                  <TD className="text-muted">Aucun entraînement enregistré.</TD>
                </tr>
              )}
            </tbody>
          </Table>
        </Card>
      </div>
    </>
  );
}
