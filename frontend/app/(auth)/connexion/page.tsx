"use client";

import { Eye, EyeOff, LogIn } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/form";
import { PageLoader } from "@/components/ui/spinner";
import { ApiError } from "@/lib/api";
import { homeFor, useAuth } from "@/lib/auth";
import type { User } from "@/lib/types";

const DEMO_ACCOUNTS = [
  { label: "Apprenante", email: "aminata@learningdata.app", password: "Demo1234!" },
  { label: "Formateur", email: "issa.traore@learningdata.app", password: "Demo1234!" },
  { label: "Admin", email: "admin@learningdata.app", password: "Admin1234!" },
];

const AREA_ROLES: Record<string, User["role"][]> = {
  "/apprenant": ["learner"],
  "/bienvenue": ["learner"],
  "/formateur": ["instructor", "admin"],
  "/admin": ["admin"],
};

function destination(user: User, next: string | null): string {
  if (next && next.startsWith("/") && !next.startsWith("//")) {
    const area = Object.keys(AREA_ROLES).find((prefix) => next.startsWith(prefix));
    if (!area || AREA_ROLES[area].includes(user.role)) {
      if (user.role === "learner" && user.onboarding_completed === false) return "/bienvenue";
      return next;
    }
  }
  return homeFor(user);
}

function LoginForm() {
  const { user, loading, login } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && user) router.replace(destination(user, next));
  }, [loading, user, next, router]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const logged = await login(email, password);
      router.replace(destination(logged, next));
    } catch (err) {
      setError(err as ApiError);
      setSubmitting(false);
    }
  }

  return (
    <>
      <h1 className="text-3xl font-bold tracking-tight">Bon retour !</h1>
      <p className="mt-2 text-muted">Connecte-toi pour reprendre là où tu t&apos;étais arrêté.</p>

      <form onSubmit={submit} className="mt-8 space-y-5" noValidate>
        {error && (
          <div className="rounded-xl border border-red-200 bg-danger-50 px-4 py-3 text-sm font-medium text-danger-600" role="alert">
            {error.message}
          </div>
        )}
        <Input
          label="Adresse e-mail"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={error?.field("email")}
          placeholder="toi@exemple.com"
        />
        <div className="relative">
          <Input
            label="Mot de passe"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={error?.field("password")}
            className="pr-11"
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute top-[34px] right-3 rounded p-1 text-muted hover:text-ink"
            aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
          >
            {showPassword ? <EyeOff className="size-[18px]" /> : <Eye className="size-[18px]" />}
          </button>
        </div>
        <Button type="submit" fullWidth size="lg" loading={submitting} icon={<LogIn className="size-4" />} disabled={!email || !password}>
          Se connecter
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted">
        Pas encore de compte ?{" "}
        <Link href="/inscription" className="font-semibold text-brand-600 hover:underline">
          Créer un compte
        </Link>
      </p>

      <div className="mt-8 rounded-2xl border border-dashed border-line bg-canvas p-4">
        <p className="text-xs font-semibold tracking-wide text-muted uppercase">Comptes de démonstration</p>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {DEMO_ACCOUNTS.map((account) => (
            <button
              key={account.email}
              type="button"
              onClick={() => {
                setEmail(account.email);
                setPassword(account.password);
                setError(null);
              }}
              className="rounded-lg border border-line bg-white px-2 py-2 text-xs font-semibold text-ink hover:border-brand-600 hover:text-brand-700"
            >
              {account.label}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<PageLoader />}>
      <LoginForm />
    </Suspense>
  );
}
