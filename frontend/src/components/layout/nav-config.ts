import {
  BarChart3,
  BookOpen,
  ClipboardCheck,
  Cpu,
  Gauge,
  History,
  Home,
  Layers,
  LayoutDashboard,
  LineChart,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
  User,
  Users,
  type LucideIcon,
} from "lucide-react";

import type { Role } from "@/lib/types";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  exact?: boolean;
  badgeKey?: "pending_courses";
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

export const NAVIGATION: Record<Role, NavSection[]> = {
  learner: [
    {
      title: "Mon apprentissage",
      items: [
        { href: "/apprenant", label: "Tableau de bord", icon: Home, exact: true },
        { href: "/apprenant/mes-cours", label: "Mes cours", icon: BookOpen },
        { href: "/apprenant/catalogue", label: "Catalogue", icon: Search },
        { href: "/apprenant/recommandations", label: "Recommandations", icon: Sparkles },
        { href: "/apprenant/progression", label: "Progression", icon: BarChart3 },
        { href: "/apprenant/profil", label: "Mon profil", icon: User },
      ],
    },
  ],
  instructor: [
    {
      title: "Espace formateur",
      items: [
        { href: "/formateur", label: "Vue d'ensemble", icon: LayoutDashboard, exact: true },
        { href: "/formateur/risques", label: "Apprenants à risque", icon: TriangleAlert },
        { href: "/formateur/analytics", label: "Learning analytics", icon: LineChart },
        { href: "/formateur/cours", label: "Gestion des cours", icon: Layers },
        { href: "/formateur/modeles", label: "Modèles ML", icon: Cpu },
        { href: "/formateur/profil", label: "Mon profil", icon: User },
      ],
    },
  ],
  admin: [
    {
      title: "Administration",
      items: [
        { href: "/admin", label: "Tableau de bord", icon: Gauge, exact: true },
        { href: "/admin/utilisateurs", label: "Utilisateurs", icon: Users },
        { href: "/admin/roles", label: "Rôles et permissions", icon: ShieldCheck },
        { href: "/admin/validation", label: "Validation des cours", icon: ClipboardCheck, badgeKey: "pending_courses" },
        { href: "/admin/parametres", label: "Paramètres", icon: Settings },
        { href: "/admin/journal", label: "Journal d'activité", icon: History },
      ],
    },
    {
      title: "Pédagogie",
      items: [
        { href: "/formateur", label: "Vue d'ensemble", icon: LayoutDashboard, exact: true },
        { href: "/formateur/risques", label: "Apprenants à risque", icon: TriangleAlert },
        { href: "/formateur/analytics", label: "Learning analytics", icon: LineChart },
        { href: "/formateur/cours", label: "Tous les cours", icon: Layers },
        { href: "/formateur/modeles", label: "Modèles ML", icon: Cpu },
      ],
    },
  ],
};
