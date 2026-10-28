"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";

import { cn } from "@/lib/cn";
import { formatNumber } from "@/lib/format";

// Règles communes : une seule couleur par série, grille discrète, info-bulle au survol.
const AXIS = { fontSize: 12, fill: "#64748B" };
const GRID = "#E9EDF3";
const BRAND = "#2D5BE3";
const BRAND_SOFT = "#B9C8F5";

function TooltipBox({ title, lines }: { title: string; lines: { label: string; value: string; color?: string }[] }) {
  return (
    <div className="rounded-lg border border-line bg-white px-3 py-2 text-xs shadow-pop">
      <p className="mb-1 font-semibold text-ink">{title}</p>
      {lines.map((line) => (
        <p key={line.label} className="flex items-center gap-2 text-muted">
          {line.color && <span className="size-2 rounded-full" style={{ backgroundColor: line.color }} />}
          <span>{line.label} :</span>
          <span className="font-semibold text-ink">{line.value}</span>
        </p>
      ))}
    </div>
  );
}

/** Histogramme à une série. Une barre peut être mise en avant (couleur pleine). */
export function SimpleBarChart({
  data,
  height = 240,
  highlight,
  valueLabel = "Valeur",
  format = (v: number) => formatNumber(v),
  danger,
  domain,
}: {
  data: { label: string; value: number; title?: string }[];
  height?: number;
  highlight?: number;
  valueLabel?: string;
  format?: (value: number) => string;
  danger?: boolean;
  /** Bornes de l'axe vertical (ex. [0, 1] pour un score). Active les graduations décimales. */
  domain?: [number, number];
}) {
  const strong = danger ? "#DC2626" : BRAND;
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 4, left: -18, bottom: 0 }} barCategoryGap="22%">
          <CartesianGrid vertical={false} stroke={GRID} />
          <XAxis dataKey="label" tick={AXIS} axisLine={false} tickLine={false} interval={0} />
          <YAxis tick={AXIS} axisLine={false} tickLine={false} allowDecimals={Boolean(domain)} domain={domain} tickFormatter={domain ? (v: number) => format(v) : undefined} width={44} />
          <Tooltip
            cursor={{ fill: "rgba(45,91,227,0.06)" }}
            content={({ active, payload }) =>
              active && payload?.length ? (
                <TooltipBox
                  title={(payload[0].payload as { title?: string; label: string }).title ?? String(payload[0].payload.label)}
                  lines={[{ label: valueLabel, value: format(Number(payload[0].value)) }]}
                />
              ) : null
            }
          />
          <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={44}>
            {data.map((_, index) => (
              <Cell key={index} fill={highlight === undefined || highlight === index ? strong : BRAND_SOFT} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Courbe avec aire légère (évolution dans le temps). */
export function TrendChart({
  data,
  height = 220,
  valueLabel = "Valeur",
  format = (v: number) => formatNumber(v),
  domain,
  tickInterval = "preserveStartEnd",
}: {
  data: { label: string; value: number; title?: string }[];
  height?: number;
  valueLabel?: string;
  format?: (value: number) => string;
  domain?: [number, number];
  tickInterval?: number | "preserveStartEnd";
}) {
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
          <defs>
            <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={BRAND} stopOpacity={0.18} />
              <stop offset="100%" stopColor={BRAND} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke={GRID} />
          <XAxis dataKey="label" tick={AXIS} axisLine={false} tickLine={false} interval={tickInterval} minTickGap={18} />
          <YAxis tick={AXIS} axisLine={false} tickLine={false} domain={domain ?? ["auto", "auto"]} width={44} />
          <Tooltip
            cursor={{ stroke: "#94A3B8", strokeDasharray: "4 4" }}
            content={({ active, payload }) =>
              active && payload?.length ? (
                <TooltipBox
                  title={(payload[0].payload as { title?: string; label: string }).title ?? String(payload[0].payload.label)}
                  lines={[{ label: valueLabel, value: format(Number(payload[0].value)), color: BRAND }]}
                />
              ) : null
            }
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke={BRAND}
            strokeWidth={2}
            fill="url(#trendFill)"
            dot={data.length <= 12 ? { r: 4, fill: "#fff", stroke: BRAND, strokeWidth: 2 } : false}
            activeDot={{ r: 5, fill: BRAND, stroke: "#fff", strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Carte 2D des cours (embeddings) : chaque point est un cours, la couleur suit la catégorie. */
export function EmbeddingMap({
  points,
  height = 280,
}: {
  points: { course_id: number; title: string; category: string; color: string; x: number; y: number }[];
  height?: number;
}) {
  const categories = [...new Map(points.map((p) => [p.category, p.color])).entries()];
  return (
    <div>
      <div style={{ height }} className="w-full rounded-xl bg-slate-50">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 16, right: 16, left: 16, bottom: 16 }}>
            <XAxis type="number" dataKey="x" hide domain={[-0.05, 1.05]} />
            <YAxis type="number" dataKey="y" hide domain={[-0.05, 1.05]} />
            <ZAxis range={[90, 90]} />
            <Tooltip
              cursor={false}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const p = payload[0].payload as (typeof points)[number];
                return <TooltipBox title={p.title} lines={[{ label: "Catégorie", value: p.category, color: p.color }]} />;
              }}
            />
            <Scatter data={points} isAnimationActive={false}>
              {points.map((p) => (
                <Cell key={p.course_id} fill={p.color} stroke="#fff" strokeWidth={2} />
              ))}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      </div>
      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5" aria-label="Légende">
        {categories.map(([name, color]) => (
          <li key={name} className="flex items-center gap-1.5 text-xs text-muted">
            <span className="size-2.5 rounded-full" style={{ backgroundColor: color }} />
            {name}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Barre empilée horizontale (répartition), avec une légende chiffrée. */
export function StackedBar({
  segments,
  className,
}: {
  segments: { label: string; value: number; color: string }[];
  className?: string;
}) {
  const total = segments.reduce((sum, s) => sum + s.value, 0) || 1;
  return (
    <div className={className}>
      <div className="flex h-4 w-full gap-0.5 overflow-hidden rounded-full bg-slate-100">
        {segments.map((s) =>
          s.value > 0 ? (
            <div key={s.label} title={`${s.label} : ${formatNumber(s.value)}`} style={{ width: `${(100 * s.value) / total}%`, backgroundColor: s.color }} />
          ) : null,
        )}
      </div>
      <ul className="mt-4 space-y-2.5">
        {segments.map((s) => (
          <li key={s.label} className="flex items-center justify-between gap-3 text-sm">
            <span className="flex items-center gap-2.5">
              <span className="size-3 rounded-full" style={{ backgroundColor: s.color }} />
              {s.label}
            </span>
            <span className="font-semibold">
              {formatNumber(s.value)} <span className="font-normal text-muted">· {formatNumber((100 * s.value) / total)} %</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Entonnoir : une barre horizontale par étape. */
export function Funnel({ steps, highlightLabel }: { steps: { label: string; value: number }[]; highlightLabel?: string }) {
  const max = Math.max(...steps.map((s) => s.value), 1);
  return (
    <ul className="space-y-2.5">
      {steps.map((step) => (
        <li key={step.label} className="grid grid-cols-[88px_1fr_auto] items-center gap-3 text-sm">
          <span className="truncate text-muted">{step.label}</span>
          <div className="h-5 overflow-hidden rounded-md bg-slate-100">
            <div
              className={cn("h-full rounded-md", step.label === highlightLabel ? "bg-danger-600" : "bg-brand-600")}
              style={{ width: `${(100 * step.value) / max}%` }}
            />
          </div>
          <span className="w-24 text-right font-semibold tabular-nums">
            {formatNumber(step.value)} <span className="text-xs font-normal text-muted">· {formatNumber((100 * step.value) / (steps[0]?.value || 1))} %</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Calendrier d'activité (une case par jour, intensité selon le nombre d'actions). */
export function ActivityHeatmap({ days }: { days: { date: string; count: number }[] }) {
  const max = Math.max(...days.map((d) => d.count), 1);
  const shade = (count: number) => {
    if (!count) return "#F1F5F9";
    const ratio = count / max;
    if (ratio > 0.66) return "#2D5BE3";
    if (ratio > 0.33) return "#7D9CF0";
    return "#C7D4F8";
  };
  return (
    <div>
      <div className="grid grid-cols-10 gap-1.5 sm:grid-cols-15">
        {days.map((day) => (
          <div
            key={day.date}
            title={`${new Date(day.date).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })} : ${day.count} action${day.count > 1 ? "s" : ""}`}
            className="aspect-square rounded-md border border-white"
            style={{ backgroundColor: shade(day.count) }}
          />
        ))}
      </div>
      <div className="mt-3 flex items-center justify-end gap-1.5 text-xs text-muted">
        Moins
        {["#F1F5F9", "#C7D4F8", "#7D9CF0", "#2D5BE3"].map((c) => (
          <span key={c} className="size-3 rounded-sm" style={{ backgroundColor: c }} />
        ))}
        Plus
      </div>
    </div>
  );
}

/** Anneau de score (quiz). */
export function ScoreRing({ value, size = 150, label }: { value: number; size?: number; label?: string }) {
  const stroke = 13;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = Math.max(0, Math.min(100, value));
  const color = pct >= 70 ? "#16A34A" : pct >= 50 ? "#F59E0B" : "#DC2626";
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#E9EDF3" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - pct / 100)}
          className="transition-[stroke-dashoffset] duration-700"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-bold">{formatNumber(pct)} %</span>
        {label && <span className="text-sm text-muted">{label}</span>}
      </div>
    </div>
  );
}

/** Contributions de chaque signal au risque (rouge = augmente, vert = réduit). */
export function ContributionBars({ items }: { items: { text: string; contribution: number }[] }) {
  const max = Math.max(...items.map((i) => Math.abs(i.contribution)), 0.01);
  return (
    <ul className="space-y-3">
      {items.map((item) => {
        const positive = item.contribution > 0;
        return (
          <li key={item.text} className="grid grid-cols-1 gap-1.5 sm:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)_56px] sm:items-center sm:gap-3">
            <span className="text-sm text-ink">{item.text}</span>
            <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
              <div
                className={cn("h-full rounded-full", positive ? "bg-danger-600" : "bg-success-600")}
                style={{ width: `${(100 * Math.abs(item.contribution)) / max}%` }}
              />
            </div>
            <span className={cn("text-sm font-semibold tabular-nums sm:text-right", positive ? "text-danger-600" : "text-success-600")}>
              {positive ? "+" : "−"}
              {formatNumber(Math.abs(item.contribution), 2)}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
