import { Compass } from "lucide-react";

import { LinkButton } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-canvas px-6 text-center">
      <span className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
        <Compass className="size-7" />
      </span>
      <p className="text-sm font-semibold text-brand-600">Erreur 404</p>
      <h1 className="mt-1 text-3xl font-bold">Cette page n&apos;existe pas</h1>
      <p className="mt-2 max-w-md text-muted">Le lien est peut-être incorrect, ou la page a été déplacée.</p>
      <div className="mt-6 flex gap-3">
        <LinkButton href="/">Retour à l&apos;accueil</LinkButton>
        <LinkButton href="/catalogue" variant="secondary">
          Voir le catalogue
        </LinkButton>
      </div>
    </div>
  );
}
