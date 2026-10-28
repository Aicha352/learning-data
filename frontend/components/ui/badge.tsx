import { cn } from "@/lib/cn";

export type Tone = "brand" | "success" | "warning" | "danger" | "neutral" | "violet" | "dark";

const tones: Record<Tone, string> = {
  brand: "bg-brand-50 text-brand-700",
  success: "bg-success-50 text-success-600",
  warning: "bg-warning-50 text-warning-700",
  danger: "bg-danger-50 text-danger-600",
  neutral: "bg-slate-100 text-slate-600",
  violet: "bg-violet-50 text-violet-600",
  dark: "bg-ink text-white",
};

export function Badge({
  tone = "neutral",
  children,
  className,
  icon,
}: {
  tone?: Tone;
  children: React.ReactNode;
  className?: string;
  icon?: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-semibold whitespace-nowrap",
        tones[tone],
        className,
      )}
    >
      {icon}
      {children}
    </span>
  );
}
