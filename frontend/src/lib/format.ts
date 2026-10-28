// Fonctions d'affichage en français.

const numberFormat = new Intl.NumberFormat("fr-FR");

export function formatNumber(value: number | null | undefined, digits = 0): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(value);
}

/** 0,42 → « 42 % » */
export function formatPercent(ratio: number | null | undefined, digits = 0): string {
  if (ratio === null || ratio === undefined || Number.isNaN(ratio)) return "—";
  return `${formatNumber(ratio * 100, digits)} %`;
}

/** Score déjà exprimé sur 100 → « 75 % » */
export function formatScore(score: number | null | undefined): string {
  if (score === null || score === undefined) return "—";
  return `${formatNumber(score, 0)} %`;
}

export function formatDecimal(value: number | null | undefined, digits = 2): string {
  if (value === null || value === undefined) return "—";
  return formatNumber(value, digits);
}

export function formatDuration(minutes: number | null | undefined): string {
  if (!minutes) return "0 min";
  if (minutes < 60) return `${Math.round(minutes)} min`;
  const hours = Math.floor(minutes / 60);
  const rest = Math.round(minutes % 60);
  return rest ? `${hours} h ${String(rest).padStart(2, "0")}` : `${hours} h`;
}

export function formatDate(value: string | Date | null | undefined, options?: Intl.DateTimeFormatOptions): string {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  return date.toLocaleDateString("fr-FR", options ?? { day: "numeric", month: "short", year: "numeric" });
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  return `${date.toLocaleDateString("fr-FR", { day: "numeric", month: "short" })} · ${date.toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

export function timeAgo(value: string | null | undefined): string {
  if (!value) return "Jamais";
  const diff = Date.now() - new Date(value).getTime();
  const minutes = Math.round(diff / 60000);
  if (minutes < 1) return "À l'instant";
  if (minutes < 60) return `Il y a ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `Il y a ${hours} h`;
  const days = Math.round(hours / 24);
  if (days === 1) return "Hier";
  if (days < 30) return `Il y a ${days} jours`;
  const months = Math.round(days / 30);
  return months <= 1 ? "Il y a 1 mois" : `Il y a ${months} mois`;
}

export function plural(count: number, singular: string, pluralForm?: string): string {
  return `${numberFormat.format(count)} ${count > 1 ? pluralForm ?? `${singular}s` : singular}`;
}

export function signed(value: number | null | undefined, suffix = ""): string {
  if (value === null || value === undefined) return "";
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  return `${sign}${formatNumber(Math.abs(value), Number.isInteger(value) ? 0 : 1)}${suffix}`;
}
