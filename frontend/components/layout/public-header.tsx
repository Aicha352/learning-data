"use client";

import { Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { homeFor, useAuth } from "@/lib/auth";
import { cn } from "@/lib/cn";

import { LinkButton } from "../ui/button";
import { Avatar } from "../ui/misc";
import { Logo } from "./logo";

const LINKS = [
  { href: "/catalogue", label: "Catalogue" },
  { href: "/#fonctionnement", label: "Comment ça marche" },
  { href: "/#parcours", label: "Parcours" },
];

export function PublicHeader() {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const actions = loading ? (
    <div className="h-10 w-40" />
  ) : user ? (
    <Link href={homeFor(user)} className="inline-flex items-center gap-2.5 rounded-xl border border-line bg-white py-1.5 pr-3 pl-1.5 text-sm font-semibold hover:bg-slate-50">
      <Avatar initials={user.initials} color={user.avatar_color} size={30} />
      Mon espace
    </Link>
  ) : (
    <>
      <LinkButton href="/connexion" variant="secondary">
        Se connecter
      </LinkButton>
      <LinkButton href="/inscription">S&apos;inscrire</LinkButton>
    </>
  );

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Logo />
        <nav className="hidden items-center gap-8 md:flex" aria-label="Navigation du site">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn("text-[15px] font-medium transition-colors hover:text-ink", pathname === link.href ? "text-ink" : "text-muted")}
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="hidden items-center gap-3 md:flex">{actions}</div>
        <button className="rounded-lg p-2 md:hidden" onClick={() => setOpen((v) => !v)} aria-label={open ? "Fermer le menu" : "Ouvrir le menu"} aria-expanded={open}>
          {open ? <X className="size-6" /> : <Menu className="size-6" />}
        </button>
      </div>
      {open && (
        <div className="animate-fade-in border-t border-line bg-white px-4 pt-3 pb-5 md:hidden">
          <nav className="flex flex-col" aria-label="Navigation mobile">
            {LINKS.map((link) => (
              <Link key={link.href} href={link.href} onClick={() => setOpen(false)} className="rounded-lg px-2 py-3 text-[15px] font-medium text-ink hover:bg-slate-50">
                {link.label}
              </Link>
            ))}
          </nav>
          <div className="mt-3 flex flex-wrap gap-3" onClick={() => setOpen(false)}>
            {actions}
          </div>
        </div>
      )}
    </header>
  );
}

export function PublicFooter() {
  return (
    <footer className="bg-ink text-white/70">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-10 sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">
        <div>
          <Logo light />
          <p className="mt-3 max-w-sm text-sm">La plateforme de formation qui recommande les bons cours et accompagne chaque apprenant jusqu&apos;au bout.</p>
        </div>
        <div className="flex flex-wrap gap-x-8 gap-y-2 text-sm">
          <Link href="/catalogue" className="hover:text-white">
            Catalogue
          </Link>
          <Link href="/inscription" className="hover:text-white">
            Créer un compte
          </Link>
          <Link href="/connexion" className="hover:text-white">
            Se connecter
          </Link>
          <a href="/api/docs/" className="hover:text-white">
            Documentation de l&apos;API
          </a>
        </div>
      </div>
      <div className="border-t border-white/10 py-5 text-center text-xs">© {new Date().getFullYear()} Learning Data — Plateforme de formation en ligne</div>
    </footer>
  );
}
