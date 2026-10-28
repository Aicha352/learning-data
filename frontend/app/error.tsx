"use client";

import { TriangleAlert } from "lucide-react";
import { useEffect } from "react";

import { Button, LinkButton } from "@/components/ui/button";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center px-6 text-center">
      <span className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-danger-50 text-danger-600">
        <TriangleAlert className="size-7" />
      </span>
      <h1 className="text-2xl font-bold">Oups, quelque chose s&apos;est mal passé</h1>
      <p className="mt-2 max-w-md text-muted">Une erreur inattendue est survenue. Tu peux réessayer ou revenir à l&apos;accueil.</p>
      <div className="mt-6 flex gap-3">
        <Button onClick={reset}>Réessayer</Button>
        <LinkButton href="/" variant="secondary">
          Accueil
        </LinkButton>
      </div>
    </div>
  );
}
