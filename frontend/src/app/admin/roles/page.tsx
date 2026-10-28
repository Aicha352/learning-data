"use client";

import { Check, GraduationCap, Minus, ShieldCheck, UserRound } from "lucide-react";
import Link from "next/link";

import { Card, CardBody } from "@/components/ui/card";
import { ErrorState, PageHeader, Skeleton, Table, TD, TH } from "@/components/ui/misc";
import { formatNumber, plural } from "@/lib/format";
import { useApi } from "@/lib/hooks";
import type { Role, RolesResponse } from "@/lib/types";

const ROLE_ICON: Record<Role, React.ReactNode> = {
  learner: <UserRound className="size-5" />,
  instructor: <GraduationCap className="size-5" />,
  admin: <ShieldCheck className="size-5" />,
};
const ROLE_STYLE: Record<Role, string> = {
  learner: "bg-brand-50 text-brand-600",
  instructor: "bg-violet-50 text-violet-600",
  admin: "bg-slate-900 text-white",
};

function Allowed({ value }: { value: boolean }) {
  return value ? (
    <span className="inline-flex size-6 items-center justify-center rounded-full bg-success-50 text-success-600">
      <Check className="size-4" aria-label="Autorisé" />
    </span>
  ) : (
    <span className="inline-flex size-6 items-center justify-center text-slate-300">
      <Minus className="size-4" aria-label="Non autorisé" />
    </span>
  );
}

export default function RolesPage() {
  const { data, error, isLoading, mutate } = useApi<RolesResponse>("/api/admin/roles/");

  if (error) return <ErrorState message={error.message} onRetry={() => mutate()} />;

  return (
    <>
      <PageHeader title="Rôles et permissions" subtitle="Chaque compte a un seul rôle. Le rôle se change depuis la page Utilisateurs." />
      {isLoading || !data ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-40 rounded-2xl" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {data.roles.map((role) => (
              <Card key={role.key}>
                <CardBody>
                  <div className="flex items-center gap-3">
                    <span className={`flex size-10 items-center justify-center rounded-xl ${ROLE_STYLE[role.key]}`}>{ROLE_ICON[role.key]}</span>
                    <div>
                      <p className="font-semibold">{role.label}</p>
                      <p className="text-xs text-muted">{plural(role.count, "compte")}</p>
                    </div>
                  </div>
                  <p className="mt-3 text-sm text-muted">{role.description}</p>
                  <Link href={`/admin/utilisateurs?role=${role.key}`} className="mt-3 inline-block text-sm font-semibold text-brand-600 hover:text-brand-700">
                    Voir les {formatNumber(role.count)} comptes →
                  </Link>
                </CardBody>
              </Card>
            ))}
          </div>
          <Table className="mt-6">
            <thead>
              <tr>
                <TH>Permission</TH>
                <TH className="text-center">Apprenant</TH>
                <TH className="text-center">Formateur</TH>
                <TH className="text-center">Administrateur</TH>
              </tr>
            </thead>
            <tbody>
              {data.permissions.map((p) => (
                <tr key={p.label}>
                  <TD>{p.label}</TD>
                  <TD className="text-center">
                    <Allowed value={p.learner} />
                  </TD>
                  <TD className="text-center">
                    <Allowed value={p.instructor} />
                  </TD>
                  <TD className="text-center">
                    <Allowed value={p.admin} />
                  </TD>
                </tr>
              ))}
            </tbody>
          </Table>
        </>
      )}
    </>
  );
}
