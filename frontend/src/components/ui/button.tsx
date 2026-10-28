import Link from "next/link";
import { forwardRef } from "react";

import { cn } from "@/lib/cn";

import { Spinner } from "./spinner";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "danger-ghost" | "subtle";
type Size = "sm" | "md" | "lg";

const variants: Record<Variant, string> = {
  primary: "bg-brand-600 text-white hover:bg-brand-700 shadow-sm disabled:bg-brand-200",
  secondary: "bg-white text-ink border border-line hover:bg-slate-50 hover:border-slate-300 disabled:text-slate-400",
  ghost: "text-muted hover:text-ink hover:bg-slate-100",
  danger: "bg-danger-600 text-white hover:bg-red-700 shadow-sm disabled:bg-red-200",
  "danger-ghost": "text-danger-600 hover:bg-danger-50 disabled:text-red-300",
  subtle: "bg-brand-50 text-brand-700 hover:bg-brand-100",
};

const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-[13px] gap-1.5 rounded-lg",
  md: "h-10 px-4 text-sm gap-2 rounded-[10px]",
  lg: "h-12 px-5 text-[15px] gap-2 rounded-xl",
};

interface CommonProps {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: React.ReactNode;
  fullWidth?: boolean;
  className?: string;
  children?: React.ReactNode;
}

type ButtonProps = CommonProps & React.ButtonHTMLAttributes<HTMLButtonElement>;

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", loading, icon, fullWidth, className, children, disabled, type = "button", ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      className={cn(
        "inline-flex shrink-0 items-center justify-center font-semibold whitespace-nowrap transition-colors disabled:cursor-not-allowed",
        variants[variant],
        sizes[size],
        fullWidth && "w-full",
        className,
      )}
      {...props}
    >
      {loading ? <Spinner className="size-4" /> : icon}
      {children}
    </button>
  );
});

type LinkButtonProps = CommonProps & { href: string; target?: string; onClick?: () => void };

export function LinkButton({ href, variant = "primary", size = "md", icon, fullWidth, className, children, ...props }: LinkButtonProps) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex shrink-0 items-center justify-center font-semibold whitespace-nowrap transition-colors",
        variants[variant],
        sizes[size],
        fullWidth && "w-full",
        className,
      )}
      {...props}
    >
      {icon}
      {children}
    </Link>
  );
}
