"use client";

import { useEffect, useState } from "react";

import { cn } from "@/lib/cn";

/** Menu déroulant simple : se ferme au clic extérieur ou avec Échap. */
export function Dropdown({
  trigger,
  children,
  align = "right",
  className,
  label,
}: {
  trigger: (props: { open: boolean; toggle: () => void }) => React.ReactNode;
  children: (close: () => void) => React.ReactNode;
  align?: "left" | "right";
  className?: string;
  label?: string;
}) {
  const [position, setPosition] = useState<{ top: number; left?: number; right?: number; up: boolean } | null>(null);
  const [anchor, setAnchor] = useState<HTMLDivElement | null>(null);
  const open = position !== null;

  // Le menu est positionné en "fixed" pour ne pas être coupé par un conteneur qui défile (tableaux).
  const toggle = () => {
    if (open || !anchor) return setPosition(null);
    const rect = anchor.getBoundingClientRect();
    const up = window.innerHeight - rect.bottom < 260 && rect.top > 260;
    setPosition({
      top: up ? rect.top - 8 : rect.bottom + 8,
      up,
      ...(align === "right" ? { right: window.innerWidth - rect.right } : { left: rect.left }),
    });
  };

  useEffect(() => {
    if (!open) return;
    const close = () => setPosition(null);
    const onClick = (event: MouseEvent) => {
      if (anchor && !anchor.contains(event.target as Node)) close();
    };
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && close();
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    const onScroll = (event: Event) => {
      if (anchor && event.target instanceof Node && anchor.contains(event.target)) return;
      close();
    };
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", close);
    };
  }, [open, anchor]);

  return (
    <div ref={setAnchor} className="relative">
      {trigger({ open, toggle })}
      {position && (
        <div
          role="menu"
          aria-label={label}
          style={{ top: position.top, left: position.left, right: position.right, transform: position.up ? "translateY(-100%)" : undefined }}
          className={cn("animate-fade-in fixed z-50 min-w-52 overflow-hidden rounded-xl border border-line bg-white p-1 shadow-pop", className)}
        >
          {children(() => setPosition(null))}
        </div>
      )}
    </div>
  );
}

export function DropdownItem({
  children,
  onClick,
  danger,
  icon,
}: {
  children: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
  icon?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors",
        danger ? "text-danger-600 hover:bg-danger-50" : "text-ink hover:bg-slate-100",
      )}
    >
      {icon}
      {children}
    </button>
  );
}
