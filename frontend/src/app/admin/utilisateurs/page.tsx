"use client";

import { Copy, KeyRound, MoreHorizontal, Pencil, Search, ShieldOff, Trash2, UserCheck, UserPlus } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

import { Badge, type Tone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dropdown, DropdownItem } from "@/components/ui/dropdown";
import { Input, Select } from "@/components/ui/form";
import { Avatar, EmptyState, ErrorState, PageHeader, Pagination, Skeleton, Table, TD, TH } from "@/components/ui/misc";
import { ConfirmDialog, Modal } from "@/components/ui/modal";
import { PageLoader } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/toast";
import { api, ApiError, withQuery } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { formatDate, formatNumber, timeAgo } from "@/lib/format";
import { useApi, useDebounced } from "@/lib/hooks";
import type { AdminUser, Paginated, Role, UserStatus } from "@/lib/types";

const ROLE_OPTIONS = [
  { value: "learner", label: "Apprenant" },
  { value: "instructor", label: "Formateur" },
  { value: "admin", label: "Administrateur" },
];
const STATUS_OPTIONS = [
  { value: "active", label: "Actif" },
  { value: "pending", label: "En attente" },
  { value: "suspended", label: "Suspendu" },
];
const ROLE_TONE: Record<Role, Tone> = { learner: "brand", instructor: "violet", admin: "dark" };
const STATUS_TONE: Record<UserStatus, Tone> = { active: "success", pending: "warning", suspended: "danger" };

type Confirm = { kind: "suspend" | "activate" | "reset" | "delete"; user: AdminUser };

function PasswordModal({ value, email, onClose }: { value: { password: string; email: string } | null; email?: string; onClose: () => void }) {
  const toast = useToast();
  return (
    <Modal open={Boolean(value)} onClose={onClose} title="Mot de passe temporaire" description={`Il a aussi été envoyé par e-mail à ${value?.email ?? email ?? ""}. Il ne sera plus affiché ensuite.`} size="sm" footer={<Button onClick={onClose}>J&apos;ai noté le mot de passe</Button>}>
      <div className="flex items-center gap-2 rounded-xl bg-slate-50 p-3">
        <code className="flex-1 font-mono text-lg font-semibold break-all">{value?.password}</code>
        <Button
          variant="secondary"
          size="sm"
          icon={<Copy className="size-4" />}
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(value?.password ?? "");
              toast.success("Copié dans le presse-papiers.");
            } catch {
              toast.error("Copie impossible : sélectionne le texte manuellement.");
            }
          }}
        >
          Copier
        </Button>
      </div>
    </Modal>
  );
}

function UserFormModal({ open, user, onClose, onSaved }: { open: boolean; user: AdminUser | null; onClose: () => void; onSaved: (result: AdminUser & { temporary_password?: string }) => void }) {
  const [values, setValues] = useState({
    first_name: user?.first_name ?? "",
    last_name: user?.last_name ?? "",
    email: user?.email ?? "",
    headline: user?.headline ?? "",
    role: (user?.role ?? "learner") as Role,
    status: (user?.status ?? "active") as UserStatus,
  });
  const [error, setError] = useState<ApiError | null>(null);
  const [saving, setSaving] = useState(false);
  const set = (key: keyof typeof values, value: string) => setValues((v) => ({ ...v, [key]: value }));

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const result = user
        ? await api<AdminUser>(`/api/admin/users/${user.id}/`, { method: "PATCH", body: { first_name: values.first_name, last_name: values.last_name, headline: values.headline, role: values.role, status: values.status } })
        : await api<AdminUser & { temporary_password: string }>("/api/admin/users/", { method: "POST", body: { first_name: values.first_name, last_name: values.last_name, email: values.email, headline: values.headline, role: values.role } });
      onSaved(result);
    } catch (err) {
      setError(err as ApiError);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={user ? `Modifier ${user.full_name}` : "Créer un compte"}
      description={user ? undefined : "Un mot de passe temporaire sera généré et envoyé par e-mail."}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit" form="user-form" loading={saving}>
            {user ? "Enregistrer" : "Créer le compte"}
          </Button>
        </>
      }
    >
      <form id="user-form" onSubmit={submit} className="space-y-4">
        {error && !Object.keys(error.errors).length && <p className="rounded-lg bg-danger-50 p-3 text-sm font-medium text-danger-600">{error.message}</p>}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input label="Prénom" required value={values.first_name} onChange={(e) => set("first_name", e.target.value)} error={error?.field("first_name")} />
          <Input label="Nom" required value={values.last_name} onChange={(e) => set("last_name", e.target.value)} error={error?.field("last_name")} />
        </div>
        <Input label="Adresse e-mail" type="email" required disabled={Boolean(user)} value={values.email} onChange={(e) => set("email", e.target.value)} error={error?.field("email")} />
        <Input label="Titre / fonction (facultatif)" value={values.headline} onChange={(e) => set("headline", e.target.value)} error={error?.field("headline")} placeholder="Ex. : Data scientist" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Select label="Rôle" value={values.role} onChange={(e) => set("role", e.target.value)} options={ROLE_OPTIONS} error={error?.field("role")} />
          {user && <Select label="Statut" value={values.status} onChange={(e) => set("status", e.target.value)} options={STATUS_OPTIONS} error={error?.field("status")} />}
        </div>
      </form>
    </Modal>
  );
}

function UsersContent() {
  const params = useSearchParams();
  const toast = useToast();
  const { user: me } = useAuth();
  const [query, setQuery] = useState("");
  const search = useDebounced(query);
  const [role, setRole] = useState(params.get("role") ?? "");
  const [status, setStatus] = useState(params.get("statut") ?? "");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<{ user: AdminUser | null } | null>(null);
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const [busy, setBusy] = useState(false);
  const [password, setPassword] = useState<{ password: string; email: string } | null>(null);

  const { data, error, isLoading, mutate } = useApi<Paginated<AdminUser>>(withQuery("/api/admin/users/", { search, role, status, page, page_size: 15 }), { keepPreviousData: true });

  async function runConfirm() {
    if (!confirm) return;
    const { kind, user } = confirm;
    setBusy(true);
    try {
      if (kind === "delete") {
        await api(`/api/admin/users/${user.id}/`, { method: "DELETE" });
        toast.success("Compte supprimé.");
      } else if (kind === "reset") {
        const result = await api<{ temporary_password: string }>(`/api/admin/users/${user.id}/reset-password/`, { method: "POST" });
        setPassword({ password: result.temporary_password, email: user.email });
      } else {
        await api(`/api/admin/users/${user.id}/${kind}/`, { method: "POST" });
        toast.success(kind === "suspend" ? "Compte suspendu." : "Compte activé.");
      }
      await mutate();
    } catch (err) {
      toast.error((err as ApiError).message);
    } finally {
      setBusy(false);
      setConfirm(null);
    }
  }

  const confirmText: Record<Confirm["kind"], { title: string; description: string; label: string; danger?: boolean }> = {
    suspend: { title: "Suspendre ce compte ?", description: "La personne ne pourra plus se connecter tant que le compte est suspendu.", label: "Suspendre", danger: true },
    activate: { title: "Activer ce compte ?", description: "La personne pourra se connecter immédiatement.", label: "Activer" },
    reset: { title: "Réinitialiser le mot de passe ?", description: "Un nouveau mot de passe temporaire sera généré et envoyé par e-mail. L'ancien ne fonctionnera plus.", label: "Réinitialiser" },
    delete: { title: "Supprimer ce compte ?", description: "Toutes ses inscriptions, sa progression et ses données d'apprentissage seront supprimées. Cette action est définitive.", label: "Supprimer", danger: true },
  };

  return (
    <>
      <PageHeader
        title="Utilisateurs"
        subtitle={data ? `${formatNumber(data.count)} comptes` : undefined}
        actions={
          <Button icon={<UserPlus className="size-4" />} onClick={() => setEditing({ user: null })}>
            Créer un compte
          </Button>
        }
      />
      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_200px_200px]">
        <Input icon={<Search className="size-[18px]" />} placeholder="Nom ou e-mail…" aria-label="Rechercher un utilisateur" value={query} onChange={(e) => { setQuery(e.target.value); setPage(1); }} />
        <Select aria-label="Rôle" value={role} onChange={(e) => { setRole(e.target.value); setPage(1); }} options={[{ value: "", label: "Tous les rôles" }, ...ROLE_OPTIONS]} />
        <Select aria-label="Statut" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} options={[{ value: "", label: "Tous les statuts" }, ...STATUS_OPTIONS]} />
      </div>

      {error ? (
        <ErrorState message={error.message} onRetry={() => mutate()} />
      ) : isLoading && !data ? (
        <Skeleton className="h-96 rounded-2xl" />
      ) : !data?.results.length ? (
        <EmptyState title="Aucun utilisateur trouvé" description="Modifie la recherche ou les filtres." />
      ) : (
        <>
          <Table>
            <thead>
              <tr>
                <TH>Utilisateur</TH>
                <TH>Rôle</TH>
                <TH>Statut</TH>
                <TH>Activité</TH>
                <TH>Inscrit le</TH>
                <TH>Dernière connexion</TH>
                <TH>
                  <span className="sr-only">Actions</span>
                </TH>
              </tr>
            </thead>
            <tbody>
              {data.results.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50/70">
                  <TD>
                    <div className="flex items-center gap-3">
                      <Avatar initials={u.initials} color={u.avatar_color} size={36} />
                      <div className="min-w-0">
                        <p className="font-semibold">
                          {u.full_name} {u.id === me?.id && <span className="text-xs font-normal text-muted">(toi)</span>}
                        </p>
                        <p className="truncate text-xs text-muted">{u.email}</p>
                      </div>
                    </div>
                  </TD>
                  <TD>
                    <Badge tone={ROLE_TONE[u.role]}>{u.role_label}</Badge>
                  </TD>
                  <TD>
                    <Badge tone={STATUS_TONE[u.status]}>{u.status_label}</Badge>
                  </TD>
                  <TD className="whitespace-nowrap text-muted">{u.role === "learner" ? `${u.enrollments_count} inscriptions` : u.role === "instructor" ? `${u.courses_count} cours` : "—"}</TD>
                  <TD className="whitespace-nowrap text-muted">{formatDate(u.date_joined)}</TD>
                  <TD className="whitespace-nowrap text-muted">{u.last_login ? timeAgo(u.last_login) : "Jamais"}</TD>
                  <TD className="text-right">
                    <Dropdown
                      label={`Actions pour ${u.full_name}`}
                      trigger={({ toggle, open }) => (
                        <Button variant="ghost" size="sm" aria-label={`Actions pour ${u.full_name}`} aria-expanded={open} onClick={toggle}>
                          <MoreHorizontal className="size-4" />
                        </Button>
                      )}
                    >
                      {(close) => (
                        <>
                          <DropdownItem icon={<Pencil className="size-4" />} onClick={() => { close(); setEditing({ user: u }); }}>
                            Modifier
                          </DropdownItem>
                          {u.id !== me?.id &&
                            (u.status === "active" ? (
                              <DropdownItem icon={<ShieldOff className="size-4" />} onClick={() => { close(); setConfirm({ kind: "suspend", user: u }); }}>
                                Suspendre
                              </DropdownItem>
                            ) : (
                              <DropdownItem icon={<UserCheck className="size-4" />} onClick={() => { close(); setConfirm({ kind: "activate", user: u }); }}>
                                {u.status === "pending" ? "Valider le compte" : "Réactiver"}
                              </DropdownItem>
                            ))}
                          <DropdownItem icon={<KeyRound className="size-4" />} onClick={() => { close(); setConfirm({ kind: "reset", user: u }); }}>
                            Réinitialiser le mot de passe
                          </DropdownItem>
                          {u.id !== me?.id && (
                            <DropdownItem danger icon={<Trash2 className="size-4" />} onClick={() => { close(); setConfirm({ kind: "delete", user: u }); }}>
                              Supprimer
                            </DropdownItem>
                          )}
                        </>
                      )}
                    </Dropdown>
                  </TD>
                </tr>
              ))}
            </tbody>
          </Table>
          <Pagination className="mt-5 justify-center" page={data.page} totalPages={data.total_pages} onChange={setPage} />
        </>
      )}

      {editing && (
        <UserFormModal
          key={editing.user?.id ?? "new"}
          open
          user={editing.user}
          onClose={() => setEditing(null)}
          onSaved={(result) => {
            setEditing(null);
            mutate();
            if (result.temporary_password) setPassword({ password: result.temporary_password, email: result.email });
            else toast.success("Compte mis à jour.");
          }}
        />
      )}
      {confirm && (
        <ConfirmDialog
          open
          onClose={() => setConfirm(null)}
          onConfirm={runConfirm}
          loading={busy}
          danger={confirmText[confirm.kind].danger}
          title={confirmText[confirm.kind].title}
          description={
            <>
              <strong>{confirm.user.full_name}</strong> ({confirm.user.email}) — {confirmText[confirm.kind].description}
            </>
          }
          confirmLabel={confirmText[confirm.kind].label}
        />
      )}
      <PasswordModal value={password} onClose={() => setPassword(null)} />
    </>
  );
}

export default function AdminUsersPage() {
  return (
    <Suspense fallback={<PageLoader />}>
      <UsersContent />
    </Suspense>
  );
}
