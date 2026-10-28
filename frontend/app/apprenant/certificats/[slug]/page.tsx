"use client";

import { Award, Printer } from "lucide-react";
import { useParams } from "next/navigation";

import { Button, LinkButton } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/misc";
import { PageLoader } from "@/components/ui/spinner";
import { formatDate, formatDuration } from "@/lib/format";
import { useApi } from "@/lib/hooks";

interface Certificate {
  learner: string;
  course: string;
  course_slug: string;
  instructor: string;
  completed_at: string;
  duration_minutes: number;
  certificate_id: string;
}

export default function CertificatePage() {
  const { slug } = useParams<{ slug: string }>();
  const { data, error, isLoading } = useApi<Certificate>(`/api/learn/courses/${slug}/certificate/`);

  if (isLoading) return <PageLoader />;
  if (error || !data)
    return (
      <div className="space-y-4">
        <ErrorState message={error?.message} />
        <div className="text-center">
          <LinkButton href={`/apprenant/apprendre/${slug}`} variant="secondary">
            Retour au cours
          </LinkButton>
        </div>
      </div>
    );

  return (
    <div>
      <div className="no-print mb-6 flex flex-wrap justify-between gap-3">
        <LinkButton href="/apprenant/mes-cours" variant="secondary">
          Mes cours
        </LinkButton>
        <Button onClick={() => window.print()} icon={<Printer className="size-4" />}>
          Imprimer / enregistrer en PDF
        </Button>
      </div>
      <div className="mx-auto max-w-4xl rounded-3xl border-8 border-double border-brand-200 bg-white p-8 text-center shadow-pop sm:p-14">
        <span className="mx-auto flex size-16 items-center justify-center rounded-full bg-brand-600 text-white">
          <Award className="size-8" />
        </span>
        <p className="mt-6 text-sm font-semibold tracking-[0.2em] text-brand-600 uppercase">Certificat de réussite</p>
        <p className="mt-6 text-muted">Ce certificat est décerné à</p>
        <p className="mt-2 text-3xl font-bold sm:text-4xl">{data.learner}</p>
        <p className="mt-6 text-muted">pour avoir terminé avec succès le cours</p>
        <p className="mt-2 text-2xl font-semibold text-brand-700">{data.course}</p>
        <p className="mt-6 text-sm text-muted">
          {formatDuration(data.duration_minutes)} de formation · terminé le {formatDate(data.completed_at, { day: "numeric", month: "long", year: "numeric" })}
        </p>
        <div className="mt-10 flex flex-col items-center justify-between gap-6 border-t border-line pt-6 text-sm sm:flex-row">
          <div>
            <p className="font-semibold">{data.instructor}</p>
            <p className="text-muted">Formateur</p>
          </div>
          <div className="font-bold">Learning Data</div>
          <div>
            <p className="font-mono font-semibold">{data.certificate_id}</p>
            <p className="text-muted">Numéro du certificat</p>
          </div>
        </div>
      </div>
    </div>
  );
}
