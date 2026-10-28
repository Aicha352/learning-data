"use client";

import { ExternalLink, LogOut, Menu, User as UserIcon, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/cn";
import { useApi } from "@/lib/hooks";
import type { AdminDashboard, Role } from "@/lib/types";

import { Dropdown, DropdownItem } from "../ui/dropdown";
import { Avatar } from "../ui/misc";
import { Logo } from "./logo";
import { NAVIGATION, type NavItem } from "./nav-config";
import { NotificationBell } from "./notification-bell";

const PROFILE_PATH: Record<Role, string> = {
  learner: "/apprenant/profil",
  instructor: "/formateur/profil",
  admin: "/formateur/profil",
};

function isActive(pathname: string, item: NavItem) {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const role = user?.role ?? "learner";
  const { data: dashboard } = useApi<AdminDashboard>(role === "admin" ? "/api/admin/dashboard/" : null, {
    refreshInterval: 120_000,
  });
  const badges = { pending_courses: dashboard?.todo.pending_courses ?? 0 };

  return (
    <div className="flex h-full flex-col">
      <div className="px-5 pt-6 pb-5">
        <Logo href={NAVIGATION[role][0].items[0].href} />
      </div>
      <nav className="scrollbar-thin flex-1 space-y-6 overflow-y-auto px-3" aria-label="Navigation principale">
        {NAVIGATION[role].map((section) => (
          <div key={section.title}>
            <p className="px-3 pb-2 text-[11px] font-semibold tracking-wider text-muted uppercase">{section.title}</p>
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const active = isActive(pathname, item);
                const badge = item.badgeKey ? badges[item.badgeKey] : 0;
                return (
                  <li key={item.href + item.label}>
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                        active ? "bg-brand-50 font-semibold text-brand-700" : "text-muted hover:bg-slate-100 hover:text-ink",
                      )}
                    >
                      <item.icon className="size-[19px] shrink-0" />
                      <span className="flex-1 truncate">{item.label}</span>
                      {badge > 0 && (
                        <span className="rounded-full bg-warning-500 px-1.5 py-px text-[11px] font-bold text-white">{badge}</span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
      {user && (
        <div className="m-3 flex items-center gap-3 rounded-xl bg-canvas p-3">
          <Avatar initials={user.initials} color={user.avatar_color} size={38} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{user.full_name}</p>
            <p className="truncate text-xs text-muted">{user.role_label}</p>
          </div>
          <button onClick={logout} className="rounded-lg p-2 text-muted hover:bg-white hover:text-danger-600" aria-label="Se déconnecter" title="Se déconnecter">
            <LogOut className="size-[18px]" />
          </button>
        </div>
      )}
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [drawer, setDrawer] = useState(false);

  return (
    <div className="min-h-screen lg:pl-[260px]">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[260px] border-r border-line bg-white lg:block">
        <SidebarContent />
      </aside>

      {drawer && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/40" onClick={() => setDrawer(false)} aria-hidden="true" />
          <aside className="animate-slide-in absolute inset-y-0 left-0 w-[280px] max-w-[85vw] bg-white shadow-pop">
            <button
              onClick={() => setDrawer(false)}
              className="absolute top-5 right-3 rounded-lg p-2 text-muted hover:bg-slate-100"
              aria-label="Fermer le menu"
            >
              <X className="size-5" />
            </button>
            <SidebarContent onNavigate={() => setDrawer(false)} />
          </aside>
        </div>
      )}

      <header className="no-print sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-line bg-white/90 px-4 backdrop-blur sm:px-6 lg:px-10">
        <button
          onClick={() => setDrawer(true)}
          className="-ml-1 rounded-lg p-2 text-ink hover:bg-slate-100 lg:hidden"
          aria-label="Ouvrir le menu"
        >
          <Menu className="size-5" />
        </button>
        <div className="lg:hidden">
          <Logo href="/" />
        </div>
        <div className="ml-auto flex items-center gap-2.5">
          <NotificationBell />
          {user && (
            <Dropdown
              label="Mon compte"
              trigger={({ toggle, open }) => (
                <button onClick={toggle} aria-expanded={open} aria-label="Mon compte" className="rounded-full ring-offset-2 hover:ring-2 hover:ring-brand-100">
                  <Avatar initials={user.initials} color={user.avatar_color} size={40} />
                </button>
              )}
            >
              {(close) => (
                <>
                  <div className="border-b border-line px-3 py-2.5">
                    <p className="text-sm font-semibold">{user.full_name}</p>
                    <p className="truncate text-xs text-muted">{user.email}</p>
                  </div>
                  <div className="pt-1">
                    <DropdownItem icon={<UserIcon className="size-4" />} onClick={() => { close(); router.push(PROFILE_PATH[user.role]); }}>
                      Mon compte
                    </DropdownItem>
                    <DropdownItem icon={<ExternalLink className="size-4" />} onClick={() => { close(); router.push("/"); }}>
                      Voir le site public
                    </DropdownItem>
                    <DropdownItem danger icon={<LogOut className="size-4" />} onClick={() => { close(); void logout(); }}>
                      Se déconnecter
                    </DropdownItem>
                  </div>
                </>
              )}
            </Dropdown>
          )}
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1280px] px-4 py-6 sm:px-6 sm:py-8 lg:px-10">{children}</main>
    </div>
  );
}
