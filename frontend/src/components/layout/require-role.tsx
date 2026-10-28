"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

import { homeFor, useAuth } from "@/lib/auth";
import type { Role } from "@/lib/types";

import { PageLoader } from "../ui/spinner";

/** Protège une zone de l'application : connexion obligatoire et rôle autorisé. */
export function RequireRole({ roles, children }: { roles: Role[]; children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const allowed = Boolean(user && roles.includes(user.role));

  useEffect(() => {
    if (loading) return;
    if (!user) router.replace(`/connexion?next=${encodeURIComponent(pathname)}`);
    else if (!roles.includes(user.role)) router.replace(homeFor(user));
  }, [loading, user, roles, router, pathname]);

  if (loading || !allowed) return <PageLoader />;
  return <>{children}</>;
}
