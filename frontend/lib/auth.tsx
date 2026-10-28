"use client";

import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { api, hasSessionHint } from "./api";
import { ROLE_HOME } from "./constants";
import type { User } from "./types";

interface RegisterInput {
  first_name: string;
  last_name: string;
  email: string;
  password: string;
  role: "learner" | "instructor";
  headline?: string;
}

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (input: RegisterInput) => Promise<{ user: User; pending: boolean; detail?: string }>;
  logout: () => Promise<void>;
  refresh: () => Promise<User | null>;
  setUser: (user: User | null) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/** Page d'accueil d'un utilisateur selon son rôle (et son questionnaire d'accueil). */
export function homeFor(user: User): string {
  if (user.role === "learner" && user.onboarding_completed === false) return "/bienvenue";
  return ROLE_HOME[user.role];
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!hasSessionHint()) {
      // Visiteur anonyme : inutile d'interroger l'API.
      setUser(null);
      return null;
    }
    try {
      const me = await api<User>("/api/auth/me/");
      setUser(me);
      return me;
    } catch {
      // Le jeton d'accès a peut-être expiré : on tente un renouvellement silencieux.
      try {
        const data = await api<{ user: User }>("/api/auth/refresh/", { method: "POST" });
        setUser(data.user);
        return data.user;
      } catch {
        setUser(null);
        return null;
      }
    }
  }, []);

  useEffect(() => {
    // Chargement initial de la session (setState appelé de façon asynchrone).
    void Promise.resolve()
      .then(refresh)
      .finally(() => setLoading(false));
  }, [refresh]);

  const login = useCallback(async (email: string, password: string) => {
    const data = await api<{ user: User }>("/api/auth/login/", { method: "POST", body: { email, password } });
    setUser(data.user);
    return data.user;
  }, []);

  const register = useCallback(async (input: RegisterInput) => {
    const data = await api<{ user: User; pending: boolean; detail?: string }>("/api/auth/register/", {
      method: "POST",
      body: input,
    });
    if (!data.pending) setUser(data.user);
    return data;
  }, []);

  const logout = useCallback(async () => {
    try {
      await api("/api/auth/logout/", { method: "POST" });
    } finally {
      setUser(null);
      router.push("/");
      router.refresh();
    }
  }, [router]);

  const value = useMemo(
    () => ({ user, loading, login, register, logout, refresh, setUser }),
    [user, loading, login, register, logout, refresh],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth doit être utilisé dans <AuthProvider>.");
  return context;
}
