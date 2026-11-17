"use client";

import { forwardRef, useId } from "react";
import Link from "next/link";
import { cn, avatarTone, initials } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

/* ---------- Button ---------- */

type Variant = "primary" | "secondary" | "ghost" | "danger" | "soft";
type Size = "sm" | "md" | "lg" | "icon";

const VARIANT: Record<Variant, string> = {
  primary: "bg-plum text-on-plum hover:bg-plum-hover shadow-sm",
  secondary: "border border-line-strong bg-surface text-ink hover:bg-surface-2",
  ghost: "text-ink-muted hover:bg-surface-2 hover:text-ink",
  danger: "bg-danger text-white hover:opacity-90 dark:text-[#1f1622]",
  soft: "bg-plum-soft text-plum hover:brightness-95 dark:hover:brightness-110",
};
const SIZE: Record<Size, string> = {
  sm: "h-9 px-3 text-sm gap-1.5 rounded-xl",
  md: "h-11 px-4 text-[15px] gap-2 rounded-xl",
  lg: "h-12 px-5 text-base gap-2 rounded-2xl",
  icon: "size-11 rounded-xl",
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  icon?: LucideIcon;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", icon: Icon, loading, className, children, disabled, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      className={cn(
        "inline-flex shrink-0 cursor-pointer items-center justify-center font-medium whitespace-nowrap transition-[background-color,color,box-shadow,opacity] duration-150 active:opacity-80 disabled:cursor-not-allowed disabled:opacity-50",
        VARIANT[variant],
        SIZE[size],
        className,
      )}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? (
        <span className="size-4 animate-spin rounded-full border-2 border-current border-r-transparent" aria-hidden />
      ) : (
        Icon && <Icon className={size === "sm" ? "size-4" : "size-[18px]"} aria-hidden />
      )}
      {children}
    </button>
  );
});

export function ButtonLink({
  href,
  variant = "secondary",
  size = "md",
  icon: Icon,
  className,
  children,
  ...rest
}: { href: string; variant?: Variant; size?: Size; icon?: LucideIcon; className?: string; children?: React.ReactNode } & Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href">) {
  return (
    <Link
      href={href}
      className={cn("inline-flex items-center justify-center font-medium transition-colors duration-150", VARIANT[variant], SIZE[size], className)}
      {...rest}
    >
      {Icon && <Icon className={size === "sm" ? "size-4" : "size-[18px]"} aria-hidden />}
      {children}
    </Link>
  );
}

/* ---------- Card ---------- */

export function Card({ className, children, as: As = "section", ...rest }: React.HTMLAttributes<HTMLElement> & { as?: "section" | "div" | "article" | "li" }) {
  return (
    <As className={cn("rounded-[var(--radius-card)] border border-line bg-surface shadow-card", className)} {...rest}>
      {children}
    </As>
  );
}

export function CardHeader({ title, description, action, icon: Icon }: { title: string; description?: string; action?: React.ReactNode; icon?: LucideIcon }) {
  return (
    <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-3">
      <div className="flex min-w-0 items-start gap-3">
        {Icon && (
          <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl bg-plum-soft text-plum">
            <Icon className="size-[18px]" aria-hidden />
          </span>
        )}
        <div className="min-w-0">
          <h2 className="text-lg leading-tight font-semibold text-ink">{title}</h2>
          {description && <p className="mt-0.5 text-sm text-ink-muted">{description}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

/* ---------- Badge ---------- */

const BADGE = {
  neutral: "bg-surface-2 text-ink-muted",
  plum: "bg-plum-soft text-plum",
  coral: "bg-coral-soft text-coral-ink",
  green: "bg-green-soft text-green-ink",
  amber: "bg-amber-soft text-amber-ink",
  danger: "bg-danger-soft text-danger",
};

export function Badge({ tone = "neutral", className, children, icon: Icon }: { tone?: keyof typeof BADGE; className?: string; children: React.ReactNode; icon?: LucideIcon }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap", BADGE[tone], className)}>
      {Icon && <Icon className="size-3.5" aria-hidden />}
      {children}
    </span>
  );
}

/* ---------- Form fields ---------- */

/** Full width unless the caller sets its own width. */
const widthOf = (className?: string) => (/(^|\s)(w-|max-w-)/.test(className ?? "") ? "" : "w-full");

const inputBase =
  "rounded-xl border border-line-strong bg-surface px-3.5 text-[16px] text-ink placeholder:text-ink-faint transition-colors focus:border-plum focus:outline-none focus:ring-2 focus:ring-plum/25 disabled:opacity-60";

export function Field({
  label,
  hint,
  error,
  children,
  className,
  htmlFor,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
  className?: string;
  htmlFor?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={htmlFor} className="text-sm font-medium text-ink">
        {label}
      </label>
      {children}
      {error ? (
        <p className="text-sm text-danger" role="alert">
          {error}
        </p>
      ) : (
        hint && <p className="text-xs text-ink-muted">{hint}</p>
      )}
    </div>
  );
}

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }>(function Input(
  { className, invalid, ...rest },
  ref,
) {
  return <input ref={ref} className={cn(inputBase, widthOf(className), "h-11", invalid && "border-danger", className)} aria-invalid={invalid || undefined} {...rest} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, ...rest }, ref) {
  return <textarea ref={ref} className={cn(inputBase, "w-full min-h-24 py-2.5 leading-relaxed", className)} {...rest} />;
});

export const Select = forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(function Select({ className, children, ...rest }, ref) {
  return (
    <select ref={ref} className={cn(inputBase, widthOf(className), "h-11 appearance-none bg-[length:16px] bg-[right_0.75rem_center] bg-no-repeat pr-9", className)} style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23857c88' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")" }} {...rest}>
      {children}
    </select>
  );
});

/* ---------- Switch ---------- */

export function Switch({
  checked,
  onChange,
  label,
  description,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <div className="min-w-0">
        <label htmlFor={id} className="text-[15px] font-medium text-ink">
          {label}
        </label>
        {description && <p className="text-sm text-ink-muted">{description}</p>}
      </div>
      <button
        id={id}
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative h-7 w-12 shrink-0 cursor-pointer rounded-full transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-50",
          checked ? "bg-plum" : "bg-line-strong",
        )}
      >
        <span
          className={cn(
            "absolute top-1 left-1 size-5 rounded-full bg-white shadow transition-transform duration-200",
            checked && "translate-x-5",
          )}
        />
      </button>
    </div>
  );
}

/* ---------- Segmented control ---------- */

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
  className,
}: {
  value: T;
  options: Array<{ value: T; label: string; icon?: LucideIcon }>;
  onChange: (v: T) => void;
  label: string;
  className?: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className={cn("inline-flex rounded-xl border border-line bg-surface-2 p-1", className)}>
      {options.map((o) => {
        const active = o.value === value;
        const Icon = o.icon;
        return (
          <button
            key={o.value}
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={cn(
              "inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-lg px-3 text-sm font-medium transition-colors",
              active ? "bg-surface text-ink shadow-sm" : "text-ink-muted hover:text-ink",
            )}
          >
            {Icon && <Icon className="size-4" aria-hidden />}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/* ---------- Avatar ---------- */

export function Avatar({ person, size = 44 }: { person: { id: string; firstName: string; lastName?: string }; size?: number }) {
  return (
    <span
      className={cn("grid shrink-0 place-items-center rounded-full font-semibold select-none", avatarTone(person.id))}
      style={{ width: size, height: size, fontSize: size * 0.36 }}
      aria-hidden
    >
      {initials(person)}
    </span>
  );
}

/* ---------- Page header ---------- */

export function PageHeader({
  title,
  description,
  actions,
  eyebrow,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  eyebrow?: string;
}) {
  return (
    <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow && <p className="mb-1 text-xs font-semibold tracking-[0.14em] text-coral-ink uppercase">{eyebrow}</p>}
        <h1 className="text-[28px] leading-tight font-semibold text-ink text-balance sm:text-[34px]">{title}</h1>
        {description && <p className="mt-1.5 max-w-2xl text-[15px] text-ink-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

/* ---------- Empty state ---------- */

export function EmptyState({ icon: Icon, title, body, action }: { icon: LucideIcon; title: string; body?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      <span className="mb-4 grid size-14 place-items-center rounded-2xl bg-plum-soft text-plum">
        <Icon className="size-6" aria-hidden />
      </span>
      <h3 className="text-lg font-semibold text-ink">{title}</h3>
      {body && <p className="mt-1 max-w-sm text-sm text-ink-muted">{body}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/* ---------- Stat ---------- */

export function Stat({ label, value, hint, icon: Icon }: { label: string; value: React.ReactNode; hint?: string; icon?: LucideIcon }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <div className="flex items-center gap-2 text-sm text-ink-muted">
        {Icon && <Icon className="size-4" aria-hidden />}
        {label}
      </div>
      <p className="mt-1.5 font-display text-3xl font-semibold text-ink tabular-nums">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-ink-muted">{hint}</p>}
    </div>
  );
}

export function Spinner({ label = "Loading" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-16 text-ink-muted" role="status">
      <span className="size-5 animate-spin rounded-full border-2 border-plum border-r-transparent" aria-hidden />
      <span className="text-sm">{label}…</span>
    </div>
  );
}
