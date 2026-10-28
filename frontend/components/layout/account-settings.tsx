"use client";

import { useState } from "react";

import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import type { User } from "@/lib/types";

import { Button } from "../ui/button";
import { Card, CardBody, CardHeader } from "../ui/card";
import { Input } from "../ui/form";
import { Avatar } from "../ui/misc";
import { useToast } from "../ui/toast";

/** Informations du compte et changement de mot de passe (tous les rôles). */
export function AccountSettings() {
  const { user, setUser } = useAuth();
  const toast = useToast();
  const [identity, setIdentity] = useState({
    first_name: user?.first_name ?? "",
    last_name: user?.last_name ?? "",
    headline: user?.headline ?? "",
  });
  const [identityError, setIdentityError] = useState<ApiError | null>(null);
  const [savingIdentity, setSavingIdentity] = useState(false);
  const [passwords, setPasswords] = useState({ current_password: "", new_password: "", confirm: "" });
  const [passwordError, setPasswordError] = useState<ApiError | null>(null);
  const [savingPassword, setSavingPassword] = useState(false);

  if (!user) return null;

  async function saveIdentity(event: React.FormEvent) {
    event.preventDefault();
    setIdentityError(null);
    setSavingIdentity(true);
    try {
      const updated = await api<User>("/api/auth/me/", { method: "PATCH", body: identity });
      setUser(updated);
      toast.success("Informations enregistrées.");
    } catch (err) {
      setIdentityError(err as ApiError);
    } finally {
      setSavingIdentity(false);
    }
  }

  async function savePassword(event: React.FormEvent) {
    event.preventDefault();
    setPasswordError(null);
    if (passwords.new_password !== passwords.confirm) {
      setPasswordError(new ApiError("Les deux mots de passe ne correspondent pas.", 400, { confirm: ["Les deux mots de passe ne correspondent pas."] }));
      return;
    }
    setSavingPassword(true);
    try {
      await api("/api/auth/me/password/", {
        method: "POST",
        body: { current_password: passwords.current_password, new_password: passwords.new_password },
      });
      setPasswords({ current_password: "", new_password: "", confirm: "" });
      toast.success("Mot de passe modifié.");
    } catch (err) {
      setPasswordError(err as ApiError);
    } finally {
      setSavingPassword(false);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <Card>
        <CardBody>
          <div className="mb-6 flex items-center gap-4">
            <Avatar initials={user.initials} color={user.avatar_color} size={56} />
            <div>
              <p className="text-lg font-bold">{user.full_name}</p>
              <p className="text-sm text-muted">
                {user.role_label} · membre depuis le {formatDate(user.date_joined)}
              </p>
            </div>
          </div>
          <form onSubmit={saveIdentity} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input label="Prénom" value={identity.first_name} onChange={(e) => setIdentity({ ...identity, first_name: e.target.value })} error={identityError?.field("first_name")} required />
              <Input label="Nom" value={identity.last_name} onChange={(e) => setIdentity({ ...identity, last_name: e.target.value })} error={identityError?.field("last_name")} required />
            </div>
            <Input label="Adresse e-mail" value={user.email} disabled hint="Contacte un administrateur pour changer d'adresse." />
            {user.role !== "learner" && (
              <Input label="Métier / spécialité" value={identity.headline} onChange={(e) => setIdentity({ ...identity, headline: e.target.value })} error={identityError?.field("headline")} />
            )}
            <Button type="submit" loading={savingIdentity}>
              Enregistrer
            </Button>
          </form>
        </CardBody>
      </Card>
      <Card>
        <CardBody>
          <CardHeader title="Mot de passe" subtitle="8 caractères minimum, pas uniquement des chiffres." />
          <form onSubmit={savePassword} className="mt-5 space-y-4">
            {passwordError && !Object.keys(passwordError.errors).length && <p className="text-sm font-medium text-danger-600">{passwordError.message}</p>}
            <Input
              label="Mot de passe actuel"
              type="password"
              autoComplete="current-password"
              value={passwords.current_password}
              onChange={(e) => setPasswords({ ...passwords, current_password: e.target.value })}
              error={passwordError?.field("current_password")}
              required
            />
            <Input
              label="Nouveau mot de passe"
              type="password"
              autoComplete="new-password"
              value={passwords.new_password}
              onChange={(e) => setPasswords({ ...passwords, new_password: e.target.value })}
              error={passwordError?.field("new_password")}
              required
            />
            <Input
              label="Confirmer le nouveau mot de passe"
              type="password"
              autoComplete="new-password"
              value={passwords.confirm}
              onChange={(e) => setPasswords({ ...passwords, confirm: e.target.value })}
              error={passwordError?.field("confirm")}
              required
            />
            <Button type="submit" variant="secondary" loading={savingPassword} disabled={!passwords.current_password || passwords.new_password.length < 8}>
              Changer le mot de passe
            </Button>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}
