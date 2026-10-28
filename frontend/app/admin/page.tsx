"use client";

import { BookOpen, CircleCheck, CircleX, ClipboardCheck, GraduationCap, UserCheck, UserX, Users } from "lucide-react";
import Link from "next/link";

import { StackedBar, TrendChart } from "@/components/charts/charts";
import { LinkButton } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ErrorState, PageHeader, Skeleton, StatCard } from "@/components/ui/misc";
import { useAuth } from "@/lib/auth";
import { formatNumber, plural, signed } from "@/lib/format";
import { useApi } from "@/lib/hooks";
import type { AdminDashboard } from "@/lib/types";

const SYSTEM_LABELS = { database: "Base de données", api: "API", training: "Dernier entraînement ML", notifications: "Notifications" } as const;

function deltaTone(value: number | null) {
  if (value === null) return "neutral" as const;
  return value < 0 ? ("danger" as const) : ("success" as const);
}

export default function AdminDashboardPage() {
  const { user } = useAuth();
  const { data, error, isLoading, mutate } = useApi<AdminDashboard>("/api/admin/dashboard/");

  if (error) return <ErrorState message={error.message} onRetry={() => mutate()} />;
  if (isLoading || !data)
    return (
      <div className="space-y-5">
        <Skeleton className="h-14 w-1/2" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-36 rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-80 rounded-2xl" />
      </div>
    );

  const { kpis, todo, accounts, system } = data;
  const todoItems = [
    {
      icon: <ClipboardCheck className="size-5" />,
      count: todo.pending_courses,
      label: `${plural(todo.pending_courses, "cours", "cours")} en attente de validation`,
      hint: todo.oldest_pending_days !== null ? `Le plus ancien attend depuis ${todo.oldest_pending_days} j` : undefined,
      href: "/admin/validation",
      action: "Examiner",
    },
    {
      icon: <UserCheck className="size-5" />,
      count: todo.pending_instructors,
      label: `${plural(todo.pending_instructors, "compte formateur", "comptes formateurs")} à valider`,
      href: "/admin/utilisateurs?statut=pending",
      action: "Voir",
    },
    {
      icon: <UserX className="size-5" />,
      count: todo.suspended_users,
      label: plural(todo.suspended_users, "compte suspendu", "comptes suspendus"),
      href: "/admin/utilisateurs?statut=suspended",
      action: "Voir",
    },
  ];

  return (
    <>
      <PageHeader title={`Bonjour ${user?.first_name ?? ""}`} subtitle="Vue d'ensemble de la plateforme Learning Data." />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={<Users className="size-5" />}
          label="Utilisateurs inscrits"
          value={formatNumber(kpis.users)}
          delta={kpis.users_delta !== null ? `${signed(kpis.users_delta, " %")} ce mois` : undefined}
          deltaTone={deltaTone(kpis.users_delta)}
        />
        <StatCard icon={<GraduationCap className="size-5" />} tone="violet" label="Formateurs" value={formatNumber(kpis.instructors)} delta={kpis.instructors_new ? `+${kpis.instructors_new} ce mois` : undefined} />
        <StatCard icon={<BookOpen className="size-5" />} tone="success" label="Cours publiés" value={formatNumber(kpis.published_courses)} delta={kpis.published_new ? `+${kpis.published_new} ce mois` : undefined} />
        <StatCard
          icon={<ClipboardCheck className="size-5" />}
          tone="warning"
          label="Inscriptions ce mois-ci"
          value={formatNumber(kpis.enrollments_month)}
          delta={kpis.enrollments_delta !== null ? `${signed(kpis.enrollments_delta, " %")} vs mois dernier` : undefined}
          deltaTone={deltaTone(kpis.enrollments_delta)}
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Card>
          <CardBody>
            <CardHeader title="Nouvelles inscriptions" subtitle="Comptes créés par mois, sur les 12 derniers mois" />
            <div className="mt-4">
              <TrendChart data={data.monthly_signups.map((m) => ({ label: m.label, value: m.value, title: `${m.label} ${m.year}` }))} valueLabel="Inscriptions" height={260} />
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <CardHeader title="À traiter" />
            <ul className="mt-4 divide-y divide-line">
              {todoItems.map((item) => (
                <li key={item.href} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                  <span className={item.count ? "flex size-10 shrink-0 items-center justify-center rounded-xl bg-warning-50 text-warning-700" : "flex size-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-muted"}>{item.icon}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">{item.label}</p>
                    {item.hint && <p className="text-xs text-muted">{item.hint}</p>}
                  </div>
                  {item.count > 0 && (
                    <LinkButton href={item.href} size="sm" variant="secondary">
                      {item.action}
                    </LinkButton>
                  )}
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardBody>
            <CardHeader title="Répartition des comptes" subtitle={`${formatNumber(accounts.active_month)} utilisateurs actifs ces 30 derniers jours`} action={<Link href="/admin/roles" className="text-sm font-semibold text-brand-600 hover:text-brand-700">Rôles →</Link>} />
            <StackedBar
              className="mt-5"
              segments={[
                { label: "Apprenants", value: accounts.learners, color: "#2D5BE3" },
                { label: "Formateurs", value: accounts.instructors, color: "#7C3AED" },
                { label: "Administrateurs", value: accounts.admins, color: "#0D9488" },
              ]}
            />
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <CardHeader title="État du système" />
            <ul className="mt-4 space-y-3">
              {(Object.keys(SYSTEM_LABELS) as (keyof typeof SYSTEM_LABELS)[]).map((key) => (
                <li key={key} className="flex items-center gap-3 text-sm">
                  {system[key].ok ? <CircleCheck className="size-5 shrink-0 text-success-600" aria-label="OK" /> : <CircleX className="size-5 shrink-0 text-danger-600" aria-label="Problème" />}
                  <span className="font-medium">{SYSTEM_LABELS[key]}</span>
                  <span className="ml-auto truncate text-right text-muted">{system[key].label}</span>
                </li>
              ))}
            </ul>
            <div className="mt-5 flex flex-wrap gap-2">
              <LinkButton href="/formateur/modeles" size="sm" variant="secondary">
                Modèles ML
              </LinkButton>
              <LinkButton href="/admin/journal" size="sm" variant="secondary">
                Journal d&apos;activité
              </LinkButton>
            </div>
          </CardBody>
        </Card>
      </div>
    </>
  );
}
