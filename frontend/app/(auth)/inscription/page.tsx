"use client";

import { CheckCircle2, GraduationCap, Presentation } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Button, LinkButton } from "@/components/ui/button";
import { Input } from "@/components/ui/form";
import { ApiError } from "@/lib/api";
import { homeFor, useAuth } from "@/lib/auth";
import { cn } from "@/lib/cn";

const ROLES = [
  { value: "learner" as const, label: "Apprenant", description: "Je veux suivre des cours", icon: GraduationCap },
  { value: "instructor" as const, label: "Formateur", description: "Je veux créer des cours", icon: Presentation },
];

export default function RegisterPage() {
  const { user, loading, register } = useAuth();
  const router = useRouter();
  const [form, setForm] = useState({ first_name: "", last_name: "", email: "", password: "", headline: "" });
  const [role, setRole] = useState<"learner" | "instructor">("learner");
  const [error, setError] = useState<ApiError | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [pendingMessage, setPendingMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && user && !pendingMessage) router.replace(homeFor(user));
  }, [loading, user, router, pendingMessage]);

  const set = (key: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement>) =>
    setForm((current) => ({ ...current, [key]: event.target.value }));

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const result = await register({ ...form, role });
      if (result.pending) {
        setPendingMessage(result.detail ?? "Ton compte a été créé.");
        setSubmitting(false);
      } else {
        router.replace("/bienvenue");
      }
    } catch (err) {
      setError(err as ApiError);
      setSubmitting(false);
    }
  }

  if (pendingMessage) {
    return (
      <div className="text-center">
        <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-success-50 text-success-600">
          <CheckCircle2 className="size-7" />
        </span>
        <h1 className="mt-5 text-2xl font-bold">Demande envoyée</h1>
        <p className="mt-3 text-muted">{pendingMessage}</p>
        <p className="mt-2 text-sm text-muted">Tu recevras un e-mail dès que ton compte sera activé.</p>
        <LinkButton href="/" variant="secondary" className="mt-8">
          Retour à l&apos;accueil
        </LinkButton>
      </div>
    );
  }

  const passwordTooShort = form.password.length > 0 && form.password.length < 8;

  return (
    <>
      <h1 className="text-3xl font-bold tracking-tight">Crée ton compte</h1>
      <p className="mt-2 text-muted">Commence gratuitement, sans carte bancaire.</p>
      <form onSubmit={submit} className="mt-8 space-y-5" noValidate>
        {error && !Object.keys(error.errors).length && (
          <div className="rounded-xl border border-red-200 bg-danger-50 px-4 py-3 text-sm font-medium text-danger-600" role="alert">
            {error.message}
          </div>
        )}
        <fieldset>
          <legend className="mb-2 text-[13px] font-medium">Je suis…</legend>
          <div className="grid grid-cols-2 gap-3">
            {ROLES.map((item) => (
              <button
                key={item.value}
                type="button"
                aria-pressed={role === item.value}
                onClick={() => setRole(item.value)}
                className={cn(
                  "rounded-xl border p-3.5 text-left transition-colors",
                  role === item.value ? "border-brand-600 bg-brand-50 ring-1 ring-brand-600" : "border-line hover:border-slate-300",
                )}
              >
                <item.icon className={cn("size-5", role === item.value ? "text-brand-600" : "text-muted")} />
                <span className={cn("mt-2 block text-sm font-semibold", role === item.value && "text-brand-700")}>{item.label}</span>
                <span className="block text-xs text-muted">{item.description}</span>
              </button>
            ))}
          </div>
        </fieldset>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input label="Prénom" required autoComplete="given-name" value={form.first_name} onChange={set("first_name")} error={error?.field("first_name")} />
          <Input label="Nom" required autoComplete="family-name" value={form.last_name} onChange={set("last_name")} error={error?.field("last_name")} />
        </div>
        <Input label="Adresse e-mail" type="email" required autoComplete="email" value={form.email} onChange={set("email")} error={error?.field("email")} placeholder="toi@exemple.com" />
        <Input
          label="Mot de passe"
          type="password"
          required
          autoComplete="new-password"
          value={form.password}
          onChange={set("password")}
          error={error?.field("password") || error?.field("non_field_errors")}
          hint={passwordTooShort ? "Encore un peu : 8 caractères minimum." : "8 caractères minimum, pas uniquement des chiffres."}
        />
        {role === "instructor" && (
          <Input label="Ton métier ou ta spécialité" value={form.headline} onChange={set("headline")} placeholder="Ex. : Data scientist" hint="Affiché sur tes cours." />
        )}
        <Button
          type="submit"
          fullWidth
          size="lg"
          loading={submitting}
          disabled={!form.first_name || !form.last_name || !form.email || form.password.length < 8}
        >
          {role === "instructor" ? "Demander un compte formateur" : "Créer mon compte"}
        </Button>
        {role === "instructor" && <p className="text-center text-xs text-muted">Les comptes formateurs sont validés par un administrateur.</p>}
      </form>
      <p className="mt-6 text-center text-sm text-muted">
        Déjà inscrit ?{" "}
        <Link href="/connexion" className="font-semibold text-brand-600 hover:underline">
          Se connecter
        </Link>
      </p>
    </>
  );
}
