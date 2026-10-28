import { ChevronDown } from "lucide-react";
import { forwardRef, useId } from "react";

import { cn } from "@/lib/cn";

const control =
  "w-full rounded-[10px] border border-line bg-white px-3.5 text-sm text-ink placeholder:text-slate-400 transition-colors " +
  "hover:border-slate-300 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-100 disabled:bg-slate-50 disabled:text-slate-500";

export function Field({
  label,
  hint,
  error,
  children,
  className,
  htmlFor,
  required,
}: {
  label?: React.ReactNode;
  hint?: React.ReactNode;
  error?: string;
  children: React.ReactNode;
  className?: string;
  htmlFor?: string;
  required?: boolean;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {label && (
        <label htmlFor={htmlFor} className="text-[13px] font-medium text-ink">
          {label}
          {required && (
            <span className="text-danger-600" aria-hidden="true">
              {" "}
              *
            </span>
          )}
        </label>
      )}
      {children}
      {error ? (
        <p className="text-xs font-medium text-danger-600" role="alert">
          {error}
        </p>
      ) : (
        hint && <p className="text-xs text-muted">{hint}</p>
      )}
    </div>
  );
}

type InputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  label?: React.ReactNode;
  hint?: React.ReactNode;
  error?: string;
  icon?: React.ReactNode;
  containerClassName?: string;
};

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, hint, error, icon, className, containerClassName, id, required, ...props },
  ref,
) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const input = (
    <div className="relative">
      {icon && <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-slate-400">{icon}</span>}
      <input
        ref={ref}
        id={inputId}
        required={required}
        aria-invalid={Boolean(error)}
        className={cn(control, "h-11", icon && "pl-10", error && "border-danger-600", className)}
        {...props}
      />
    </div>
  );
  if (!label && !hint && !error) return <div className={containerClassName}>{input}</div>;
  return (
    <Field label={label} hint={hint} error={error} htmlFor={inputId} required={required} className={containerClassName}>
      {input}
    </Field>
  );
});

type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label?: React.ReactNode;
  hint?: React.ReactNode;
  error?: string;
  containerClassName?: string;
};

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, hint, error, className, containerClassName, id, rows = 4, required, ...props },
  ref,
) {
  const autoId = useId();
  const inputId = id ?? autoId;
  return (
    <Field label={label} hint={hint} error={error} htmlFor={inputId} required={required} className={containerClassName}>
      <textarea
        ref={ref}
        id={inputId}
        rows={rows}
        required={required}
        aria-invalid={Boolean(error)}
        className={cn(control, "py-2.5 leading-relaxed", error && "border-danger-600", className)}
        {...props}
      />
    </Field>
  );
});

type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement> & {
  label?: React.ReactNode;
  hint?: React.ReactNode;
  error?: string;
  options: { value: string | number; label: string }[];
  containerClassName?: string;
  placeholder?: string;
};

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, hint, error, options, className, containerClassName, id, placeholder, required, ...props },
  ref,
) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const select = (
    <div className="relative">
      <select
        ref={ref}
        id={inputId}
        required={required}
        aria-invalid={Boolean(error)}
        className={cn(control, "h-11 appearance-none pr-9 font-medium", error && "border-danger-600", className)}
        {...props}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted" aria-hidden="true" />
    </div>
  );
  if (!label && !hint && !error) return <div className={containerClassName}>{select}</div>;
  return (
    <Field label={label} hint={hint} error={error} htmlFor={inputId} required={required} className={containerClassName}>
      {select}
    </Field>
  );
});

export function Checkbox({
  checked,
  onChange,
  label,
  description,
  disabled,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: React.ReactNode;
  description?: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <label className={cn("flex cursor-pointer items-start gap-2.5 text-sm", disabled && "cursor-not-allowed opacity-60")}>
      <input
        type="checkbox"
        className="mt-0.5 size-[18px] shrink-0 cursor-pointer rounded border-line accent-brand-600"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span>
        <span className="text-ink">{label}</span>
        {description && <span className="block text-xs text-muted">{description}</span>}
      </span>
    </label>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-50",
        checked ? "bg-brand-600" : "bg-slate-300",
      )}
    >
      <span
        className={cn(
          "inline-block size-[18px] rounded-full bg-white shadow transition-transform",
          checked ? "translate-x-[23px]" : "translate-x-[3px]",
        )}
      />
    </button>
  );
}

export function Chip({
  active,
  onClick,
  children,
  className,
}: {
  active?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "inline-flex h-9 items-center gap-1.5 rounded-full border px-4 text-sm font-medium transition-colors",
        active ? "border-brand-600 bg-brand-600 text-white" : "border-line bg-white text-ink hover:border-slate-300 hover:bg-slate-50",
        className,
      )}
    >
      {children}
    </button>
  );
}
