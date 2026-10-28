"use client";

import { BookOpen, CalendarClock, Mail, MessageSquare } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";

import { ActivityHeatmap, ContributionBars } from "@/components/charts/charts";
import { ContactModal, type InterventionKind } from "@/components/learning/contact-modal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Avatar, ErrorState, Progress } from "@/components/ui/misc";
import { RiskBadge } from "@/components/ui/risk";
import { PageLoader } from "@/components/ui/spinner";
import { RISK } from "@/lib/constants";
import { cn } from "@/lib/cn";
import { formatDate, formatDateTime, formatDuration, formatPercent, timeAgo } from "@/lib/format";
import { useApi } from "@/lib/hooks";
import type { LearnerFile } from "@/lib/types";

export default function LearnerFilePage() {
  const { id } = useParams<{ id: string }>();
  const { data, error, isLoading, mutate } = useApi<LearnerFile>(`/api/instructor/learners/${id}/`);
  const [contact, setContact] = useState<InterventionKind | null>(null);

  if (isLoading) return <PageLoader />;
  if (error || !data) return <ErrorState message={error?.message} onRetry={() => mutate()} />;

  const { user, risk } = data;
  const riskCourse = risk ? { id: risk.course.id, title: risk.course.title } : data.courses[0] ? { id: data.courses[0].id, title: data.courses[0].title } : null;
  const trend = risk?.previous_score !== null && risk?.previous_score !== undefined ? risk.score - risk.previous_score : null;

  const actions: { kind: InterventionKind; icon: React.ReactNode; title: string; text: string }[] = [
    { kind: "reminder", icon: <Mail className="size-[18px]" />, title: "Rappel personnalisé", text: "Message avec un lien vers la leçon où l'apprenant s'est arrêté." },
    {
      kind: "course_suggestion",
      icon: <BookOpen className="size-[18px]" />,
      title: "Proposer un cours plus court",
      text: data.suggestion ? `« ${data.suggestion.title} » : ${formatDuration(data.suggestion.duration_minutes)}, très bien noté par des profils proches.` : "Choisis un cours plus accessible dans le catalogue.",
    },
    { kind: "tutoring", icon: <CalendarClock className="size-[18px]" />, title: "Planifier un tutorat", text: "15 minutes pour comprendre ce qui le bloque." },
  ];

  return (
    <>
      <nav className="mb-4 text-[13px] text-muted" aria-label="Fil d'Ariane">
        <Link href="/formateur/risques" className="hover:text-ink">
          Apprenants à risque
        </Link>
        <span className="mx-1.5">/</span>
        {user.name}
      </nav>

      <Card className="mb-6">
        <CardBody className="flex flex-col gap-5 lg:flex-row lg:items-center">
          <Avatar initials={user.initials} color={user.color} size={68} />
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-bold">{user.name}</h1>
            <p className="mt-0.5 text-sm text-muted">
              {user.email} · inscrit depuis le {formatDate(user.date_joined)} · dernière activité : {timeAgo(user.last_activity_at).toLowerCase()}
            </p>
            <div className="mt-2.5 flex flex-wrap gap-2">
              {data.profile.goal && <Badge tone="brand">Objectif : {data.profile.goal}</Badge>}
              {data.profile.level && <Badge>{data.profile.level}</Badge>}
              {data.profile.weekly_hours && <Badge>{data.profile.weekly_hours} / semaine</Badge>}
              {data.segment && <Badge tone="violet">Profil : {data.segment.name}</Badge>}
            </div>
          </div>
          {risk && (
            <div className={cn("rounded-2xl px-5 py-4", risk.level === "high" ? "bg-danger-50" : risk.level === "medium" ? "bg-warning-50" : "bg-success-50")}>
              <p className={cn("text-3xl font-bold", risk.level === "high" ? "text-danger-600" : risk.level === "medium" ? "text-warning-700" : "text-success-600")}>
                {formatPercent(risk.score)}
              </p>
              <p className="text-sm font-semibold">Risque {RISK[risk.level].label.toLowerCase()} de décrochage</p>
              <p className="text-xs text-muted">
                {risk.course.title}
                {trend !== null && Math.abs(trend) >= 0.01 && ` · ${trend > 0 ? "en hausse" : "en baisse"}`}
              </p>
            </div>
          )}
          <div className="flex flex-wrap gap-2 lg:flex-col">
            <Button icon={<MessageSquare className="size-4" />} onClick={() => setContact("message")}>
              Envoyer un message
            </Button>
            <Button variant="secondary" onClick={() => setContact("tutoring")}>
              Proposer un tutorat
            </Button>
          </div>
        </CardBody>
      </Card>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <Card>
            <CardBody>
              <CardHeader title="Pourquoi ce risque ?" subtitle="Contribution de chaque signal au score (rouge = augmente le risque, vert = le réduit)" />
              <div className="mt-5">
                {risk ? <ContributionBars items={risk.contributions} /> : <p className="text-sm text-muted">Aucune prédiction en cours pour cet apprenant (cours terminés ou inactif depuis longtemps).</p>}
              </div>
              {risk && <p className="mt-4 text-xs text-muted">Prédiction du {formatDateTime(risk.predicted_at)} · modèle de régression logistique</p>}
            </CardBody>
          </Card>
          <Card>
            <CardBody>
              <CardHeader title="Activité des 30 derniers jours" subtitle="Nombre d'actions enregistrées par jour" />
              <div className="mt-5">
                <ActivityHeatmap days={data.activity} />
              </div>
            </CardBody>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardBody>
              <CardHeader title="Cours suivis" />
              <ul className="mt-4 space-y-4">
                {data.courses.map((course) => (
                  <li key={course.id}>
                    <div className="mb-1.5 flex items-center justify-between gap-3 text-sm">
                      <span className="font-medium">{course.title}</span>
                      {course.risk_level ? <RiskBadge level={course.risk_level} /> : <span className="text-xs text-muted">{course.detail}</span>}
                    </div>
                    <Progress value={course.progress} size="sm" tone={course.status === "completed" ? "success" : course.progress < 0.3 ? "danger" : "brand"} />
                    {course.risk_level && <p className="mt-1 text-xs text-muted">{course.detail}</p>}
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>
          <Card>
            <CardBody>
              <CardHeader title="Actions recommandées" />
              <ul className="mt-4 space-y-2.5">
                {actions.map((action, index) => (
                  <li key={action.kind}>
                    <button
                      onClick={() => setContact(action.kind)}
                      className={cn("flex w-full gap-3 rounded-xl p-3.5 text-left transition-colors", index === 0 ? "bg-brand-50 hover:bg-brand-100" : "bg-slate-50 hover:bg-slate-100")}
                    >
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-white text-brand-600">{action.icon}</span>
                      <span>
                        <span className="block text-sm font-semibold">{action.title}</span>
                        <span className="text-[13px] text-muted">{action.text}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>
          <Card>
            <CardBody>
              <CardHeader title="Historique des interventions" />
              {data.interventions.length === 0 ? (
                <p className="mt-3 text-sm text-muted">Aucune intervention pour le moment.</p>
              ) : (
                <ul className="mt-3 space-y-3">
                  {data.interventions.map((item) => (
                    <li key={item.id} className="border-l-2 border-line pl-3 text-sm">
                      <p className="font-medium">
                        {formatDate(item.created_at, { day: "numeric", month: "short" })} · {item.kind_label}
                        <span className="font-normal text-muted"> par {item.instructor}</span>
                      </p>
                      <p className="line-clamp-2 text-[13px] text-muted">{item.message}</p>
                      <p className="text-xs text-muted">{item.is_read ? "Lu" : "Non lu"}{item.scheduled_for && ` · prévu le ${formatDateTime(item.scheduled_for)}`}</p>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
        </div>
      </div>

      {contact && (
        <ContactModal
          open
          onClose={() => setContact(null)}
          learner={{ id: user.id, name: user.name }}
          course={riskCourse}
          initialKind={contact}
          suggestedCourseId={data.suggestion?.id}
          onSent={() => mutate()}
        />
      )}
    </>
  );
}
