import Link from "next/link";

import { cn } from "@/lib/cn";

export function Logo({ href = "/", light, className }: { href?: string; light?: boolean; className?: string }) {
  return (
    <Link href={href} className={cn("inline-flex items-center gap-2.5", className)} aria-label="Learning Data — accueil">
      <span className="flex size-8 items-center justify-center rounded-lg bg-brand-600 text-[13px] font-bold tracking-tight text-white">LD</span>
      <span className={cn("text-[19px] font-bold tracking-tight", light ? "text-white" : "text-ink")}>Learning Data</span>
    </Link>
  );
}
