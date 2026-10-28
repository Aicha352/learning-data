import { AlertCircle, ChevronLeft, ChevronRight, Inbox } from "lucide-react";

import { cn } from "@/lib/cn";

import { Button } from "./button";

/** Barre de progression. `value` entre 0 et 1. */
export function Progress({
  value,
  className,
  tone = "brand",
  size = "md",
  label,
}: {
  value: number;
  className?: string;
  tone?: "brand" | "success" | "warning" | "danger" | "violet" | string;
  size?: "sm" | "md" | "lg";
  label?: string;
}) {
  const pct = Math.max(0, Math.min(1, value || 0)) * 100;
  const colors: Record<string, string> = {
    brand: "bg-brand-600",
    success: "bg-success-600",
    warning: "bg-warning-500",
    danger: "bg-danger-600",
    violet: "bg-violet-600",
  };
  const isHex = tone.startsWith("#");
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pct)}
      aria-label={label}
      className={cn("w-full overflow-hidden rounded-full bg-slate-200/70", { sm: "h-1.5", md: "h-2", lg: "h-3" }[size], className)}
    >
      <div
        className={cn("h-full rounded-full transition-[width] duration-500", !isHex && colors[tone])}
        style={{ width: `${pct}%`, backgroundColor: isHex ? tone : undefined }}
      />
    </div>
  );
}

export function Avatar({
  initials,
  color,
  size = 40,
  className,
}: {
  initials: string;
  color: string;
  size?: number;
  className?: string;
}) {
  return (
    <span
      className={cn("inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white select-none", className)}
      style={{ width: size, height: size, backgroundColor: color, fontSize: Math.round(size * 0.36) }}
      aria-hidden="true"
    >
      {initials}
    </span>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-lg bg-slate-200/70", className)} />;
}

export function EmptyState({
  title,
  description,
  action,
  icon,
  className,
}: {
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center rounded-2xl border border-dashed border-line bg-white px-6 py-12 text-center", className)}>
      <div className="mb-3 flex size-12 items-center justify-center rounded-full bg-slate-100 text-muted">{icon ?? <Inbox className="size-6" />}</div>
      <p className="font-semibold text-ink">{title}</p>
      {description && <p className="mt-1 max-w-md text-sm text-muted">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-red-200 bg-danger-50/50 px-6 py-10 text-center" role="alert">
      <AlertCircle className="mb-2 size-7 text-danger-600" />
      <p className="font-semibold text-ink">Impossible de charger ces données</p>
      <p className="mt-1 max-w-md text-sm text-muted">{message || "Vérifie que le serveur est lancé puis réessaie."}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" className="mt-4" onClick={onRetry}>
          Réessayer
        </Button>
      )}
    </div>
  );
}

export function Pagination({
  page,
  totalPages,
  onChange,
  className,
}: {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
  className?: string;
}) {
  if (totalPages <= 1) return null;
  const pages = new Set([1, totalPages, page - 1, page, page + 1].filter((p) => p >= 1 && p <= totalPages));
  const sorted = [...pages].sort((a, b) => a - b);
  const items: (number | "…")[] = [];
  sorted.forEach((p, index) => {
    if (index > 0 && p - sorted[index - 1] > 1) items.push("…");
    items.push(p);
  });
  return (
    <nav className={cn("flex items-center gap-1.5", className)} aria-label="Pagination">
      <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => onChange(page - 1)} aria-label="Page précédente" className="px-2">
        <ChevronLeft className="size-4" />
      </Button>
      {items.map((item, index) =>
        item === "…" ? (
          <span key={`gap-${index}`} className="px-1 text-sm text-muted">
            …
          </span>
        ) : (
          <button
            key={item}
            onClick={() => onChange(item)}
            aria-current={item === page ? "page" : undefined}
            className={cn(
              "h-8 min-w-8 rounded-lg px-2 text-[13px] font-semibold transition-colors",
              item === page ? "bg-brand-600 text-white" : "border border-line bg-white text-ink hover:bg-slate-50",
            )}
          >
            {item}
          </button>
        ),
      )}
      <Button variant="secondary" size="sm" disabled={page >= totalPages} onClick={() => onChange(page + 1)} aria-label="Page suivante" className="px-2">
        <ChevronRight className="size-4" />
      </Button>
    </nav>
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
  breadcrumb,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  breadcrumb?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:mb-7 md:flex-row md:items-end md:justify-between">
      <div className="min-w-0">
        {breadcrumb && <div className="mb-2 text-[13px] text-muted">{breadcrumb}</div>}
        <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-[28px]">{title}</h1>
        {subtitle && <p className="mt-1 text-[15px] text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function StatCard({
  icon,
  label,
  value,
  delta,
  deltaTone,
  tone = "brand",
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  delta?: React.ReactNode;
  deltaTone?: "success" | "danger" | "neutral";
  tone?: "brand" | "success" | "warning" | "danger" | "violet";
  hint?: React.ReactNode;
}) {
  const tones = {
    brand: "bg-brand-50 text-brand-600",
    success: "bg-success-50 text-success-600",
    warning: "bg-warning-50 text-warning-500",
    danger: "bg-danger-50 text-danger-600",
    violet: "bg-violet-50 text-violet-600",
  };
  return (
    <div className="rounded-2xl border border-line bg-white p-5 shadow-card">
      <div className="flex items-center justify-between gap-2">
        <span className={cn("flex size-10 items-center justify-center rounded-xl", tones[tone])}>{icon}</span>
        {delta && (
          <span
            className={cn(
              "text-[13px] font-semibold",
              deltaTone === "danger" ? "text-danger-600" : deltaTone === "neutral" ? "text-muted" : "text-success-600",
            )}
          >
            {delta}
          </span>
        )}
      </div>
      <p className="mt-3 text-[26px] leading-tight font-bold text-ink">{value}</p>
      <p className="mt-0.5 text-[13px] text-muted">{label}</p>
      {hint && <p className="mt-2 text-xs text-muted">{hint}</p>}
    </div>
  );
}

/** Tableau responsive : défilement horizontal sur petit écran. */
export function Table({ children, className, compact }: { children: React.ReactNode; className?: string; compact?: boolean }) {
  return (
    <div className={cn("overflow-hidden rounded-2xl border border-line bg-white shadow-card", className)}>
      <div className="scrollbar-thin relative overflow-x-auto">
        <table className={cn("w-full border-collapse text-left text-sm", compact ? "min-w-[480px]" : "min-w-[720px]")}>{children}</table>
      </div>
    </div>
  );
}

export function TH({ children, className }: { children?: React.ReactNode; className?: string }) {
  return (
    <th className={cn("bg-slate-50 px-4 py-3 text-xs font-semibold tracking-wide text-muted uppercase first:pl-5 last:pr-5", className)}>
      {children}
    </th>
  );
}

export function TD({ children, className }: { children?: React.ReactNode; className?: string }) {
  return <td className={cn("border-t border-line px-4 py-3.5 align-middle first:pl-5 last:pr-5", className)}>{children}</td>;
}

export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
  className,
}: {
  tabs: { value: T; label: React.ReactNode }[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}) {
  return (
    <div className={cn("scrollbar-thin -mx-1 overflow-x-auto px-1", className)}>
      <div role="tablist" className="inline-flex min-w-max gap-1 rounded-xl bg-slate-200/60 p-1">
        {tabs.map((tab) => (
          <button
            key={tab.value}
            role="tab"
            aria-selected={value === tab.value}
            onClick={() => onChange(tab.value)}
            className={cn(
              "rounded-lg px-3.5 py-2 text-sm font-medium whitespace-nowrap transition-colors",
              value === tab.value ? "bg-white font-semibold text-ink shadow-sm" : "text-muted hover:text-ink",
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  );
}
