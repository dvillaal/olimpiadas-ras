import type { ComponentProps, ReactNode } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import type { BadgeTone, StatusView } from '@/lib/domain/status';

/**
 * Componentes de interfaz compartidos.
 *
 * Todos son Server Components salvo que necesiten interacción: así el HTML
 * llega renderizado y la aplicación se siente rápida incluso en conexiones
 * lentas, algo importante para grupos que ingresan desde el celular.
 */

// ─── Botón ───────────────────────────────────────────────────────────────────

const BUTTON_VARIANTS = {
  primary: 'bg-scout-600 text-white hover:bg-scout-700 focus-visible:outline-scout-700',
  secondary: 'bg-scout-50 text-scout-700 hover:bg-scout-100 border border-scout-200',
  ghost: 'bg-transparent text-navy hover:bg-slate-100 border border-line',
  danger: 'bg-red-700 text-white hover:bg-red-800',
  gold: 'bg-gold text-navy hover:brightness-95',
} as const;

const BUTTON_SIZES = {
  sm: 'px-3 py-1.5 text-sm rounded-lg gap-1.5',
  md: 'px-4 py-2.5 text-[15px] rounded-xl gap-2',
  lg: 'px-6 py-3 text-base rounded-xl gap-2',
} as const;

export interface ButtonProps extends ComponentProps<'button'> {
  variant?: keyof typeof BUTTON_VARIANTS;
  size?: keyof typeof BUTTON_SIZES;
  block?: boolean;
}

export function Button({
  variant = 'primary',
  size = 'md',
  block = false,
  className,
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      className={cn(
        'inline-flex items-center justify-center font-semibold transition-colors',
        'disabled:cursor-not-allowed disabled:opacity-55',
        BUTTON_VARIANTS[variant],
        BUTTON_SIZES[size],
        block && 'w-full',
        className,
      )}
    />
  );
}

export interface LinkButtonProps extends ComponentProps<typeof Link> {
  variant?: keyof typeof BUTTON_VARIANTS;
  size?: keyof typeof BUTTON_SIZES;
  block?: boolean;
}

export function LinkButton({
  variant = 'primary',
  size = 'md',
  block = false,
  className,
  ...props
}: LinkButtonProps) {
  return (
    <Link
      {...props}
      className={cn(
        'inline-flex items-center justify-center font-semibold transition-colors',
        BUTTON_VARIANTS[variant],
        BUTTON_SIZES[size],
        block && 'w-full',
        className,
      )}
    />
  );
}

// ─── Insignias de estado ─────────────────────────────────────────────────────

const TONES: Record<BadgeTone, string> = {
  green: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  blue: 'bg-sky-50 text-sky-800 ring-sky-200',
  yellow: 'bg-amber-50 text-amber-800 ring-amber-200',
  orange: 'bg-orange-50 text-orange-800 ring-orange-200',
  red: 'bg-red-50 text-red-800 ring-red-200',
  gray: 'bg-slate-100 text-slate-700 ring-slate-200',
};

export function Badge({
  tone = 'gray',
  children,
  className,
}: {
  tone?: BadgeTone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold ring-1 ring-inset',
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function StatusBadge({ status }: { status: StatusView }) {
  return <Badge tone={status.tone}>{status.label}</Badge>;
}

// ─── Contenedores ────────────────────────────────────────────────────────────

export function Panel({
  title,
  description,
  actions,
  children,
  className,
}: {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('panel', className)}>
      {(title || actions) && (
        <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            {title && <h3 className="text-lg font-bold text-navy">{title}</h3>}
            {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
          </div>
          {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
        </header>
      )}
      {children}
    </section>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h2 className="text-2xl font-extrabold text-navy sm:text-3xl">{title}</h2>
        {description && <p className="mt-1.5 max-w-2xl text-slate-500">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </header>
  );
}

export function StatCard({
  icon,
  value,
  label,
  hint,
  tone = 'default',
}: {
  icon: ReactNode;
  value: ReactNode;
  label: string;
  hint?: string;
  tone?: 'default' | 'warning' | 'success' | 'danger';
}) {
  const toneClass = {
    default: 'bg-scout-50 text-scout-700',
    warning: 'bg-amber-50 text-amber-700',
    success: 'bg-emerald-50 text-emerald-700',
    danger: 'bg-red-50 text-red-700',
  }[tone];

  return (
    <div className="panel">
      <div className={cn('mb-3 grid size-11 place-items-center rounded-xl text-xl', toneClass)}>
        {icon}
      </div>
      <strong className="block text-2xl font-extrabold text-navy">{value}</strong>
      <span className="text-sm text-slate-500">{label}</span>
      {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
    </div>
  );
}

export function EmptyState({
  icon = '📭',
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-line px-6 py-12 text-center">
      <span className="mb-3 text-4xl" aria-hidden>
        {icon}
      </span>
      <p className="font-semibold text-navy">{title}</p>
      {description && <p className="mt-1 max-w-md text-sm text-slate-500">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

// ─── Avisos ──────────────────────────────────────────────────────────────────

const ALERT_TONES = {
  info: 'bg-sky-50 text-sky-900 border-sky-200',
  success: 'bg-emerald-50 text-emerald-900 border-emerald-200',
  warning: 'bg-amber-50 text-amber-900 border-amber-200',
  error: 'bg-red-50 text-red-900 border-red-200',
} as const;

export function Alert({
  tone = 'info',
  title,
  children,
  className,
}: {
  tone?: keyof typeof ALERT_TONES;
  title?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={cn('rounded-xl border px-4 py-3 text-sm leading-relaxed', ALERT_TONES[tone], className)}
    >
      {title && <p className="font-bold">{title}</p>}
      {children}
    </div>
  );
}

// ─── Formularios ─────────────────────────────────────────────────────────────

export function Field({
  label,
  htmlFor,
  error,
  hint,
  required,
  children,
  className,
}: {
  label: string;
  htmlFor?: string;
  error?: string;
  hint?: string;
  required?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="field-label" htmlFor={htmlFor}>
        {label}
        {required && (
          <span className="ml-0.5 text-red-600" aria-hidden>
            *
          </span>
        )}
      </label>
      {children}
      {hint && !error && <p className="mt-1.5 text-xs text-slate-500">{hint}</p>}
      {error && (
        <p className="field-error" role="alert">
          <span aria-hidden>⚠</span>
          {error}
        </p>
      )}
    </div>
  );
}

export function ProgressBar({ percent, label }: { percent: number; label?: string }) {
  const value = Math.max(0, Math.min(100, Math.round(percent)));
  return (
    <div>
      {label && (
        <div className="mb-1.5 flex justify-between text-sm">
          <span className="font-semibold text-navy">{label}</span>
          <span className="text-slate-500">{value}%</span>
        </div>
      )}
      <div
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label ?? 'Progreso'}
        className="h-2.5 overflow-hidden rounded-full bg-slate-200"
      >
        <div
          className="h-full rounded-full bg-scout-500 transition-[width] duration-500"
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}
