import type { ReactNode } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

function hasContent(node: ReactNode): boolean {
  if (node === null || node === undefined || node === false) return false;
  if (typeof node === "string") return node.trim().length > 0;
  return true;
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3 mb-8">
      <div>
        <h1 className="display text-3xl md:text-4xl">{title}</h1>
        {subtitle && <p className="text-base text-ink-soft mt-2">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  tone = "default",
  delta,
  tooltip,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: "default" | "good" | "attention" | "info";
  /** Period-over-period change. Positive=up, negative=down, zero=flat. */
  delta?: { value: number; label?: string; goodWhenPositive?: boolean };
  /** Optional explainer text — shows a `?` icon next to the label. */
  tooltip?: string;
}) {
  const pillClass =
    tone === "good" ? "pill-good" : tone === "attention" ? "pill-attention" : tone === "info" ? "pill-info" : "pill-normal";
  const pillText = tone === "good" ? "GOOD" : tone === "attention" ? "ATTENTION" : tone === "info" ? "NORMAL" : null;
  return (
    <div className="card p-5 md:p-6">
      <div className="flex items-center justify-between mb-3 gap-2">
        <div className="text-sm text-ink-soft inline-flex items-center gap-1.5 min-w-0">
          <span className="truncate">{label}</span>
          {tooltip && <StatTooltip text={tooltip} />}
        </div>
        {pillText && <span className={cn(pillClass, "shrink-0")}>{pillText}</span>}
      </div>
      <div className="font-sans font-medium text-2xl md:text-3xl leading-tight tracking-tight tabular-nums">{value}</div>
      <div className="mt-2 flex items-center gap-2 text-xs">
        {delta !== undefined && <DeltaPill {...delta} />}
        {hint && <span className="text-ink-soft">{hint}</span>}
      </div>
    </div>
  );
}

function StatTooltip({ text }: { text: string }) {
  return (
    <span
      tabIndex={0}
      className="group relative inline-flex items-center justify-center size-4 rounded-full bg-canvas text-ink-muted text-[9px] font-bold cursor-help hover:bg-hairline hover:text-ink-soft focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-1 align-middle shrink-0"
      aria-label={text}
    >
      ?
      <span
        role="tooltip"
        className="invisible opacity-0 group-hover:visible group-hover:opacity-100 group-focus:visible group-focus:opacity-100 transition-opacity duration-150 absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2.5 py-1.5 rounded-lg bg-ink_inverted text-white text-[11px] font-normal leading-relaxed whitespace-normal w-56 shadow-pop pointer-events-none z-50"
      >
        {text}
        <span className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 size-2 rotate-45 bg-ink_inverted" />
      </span>
    </span>
  );
}

function DeltaPill({ value, label, goodWhenPositive = true }: { value: number; label?: string; goodWhenPositive?: boolean }) {
  if (!Number.isFinite(value)) return null;
  const flat = value === 0;
  const positive = value > 0;
  const isGood = flat ? false : goodWhenPositive ? positive : !positive;
  const cls = flat
    ? "bg-canvas text-ink-muted"
    : isGood
    ? "bg-brand-50 text-brand-700"
    : "bg-red-50 text-red-700";
  const arrow = flat ? "·" : positive ? "↑" : "↓";
  const formatted = flat ? "—" : `${positive ? "+" : ""}${value.toLocaleString()}`;
  return (
    <span className={`inline-flex items-center gap-0.5 px-2 h-5 rounded-full font-medium ${cls}`}>
      <span className="text-[10px]">{arrow}</span>
      <span className="tabular-nums">{formatted}</span>
      {label && <span className="opacity-70 ml-1">{label}</span>}
    </span>
  );
}

const BADGE_STYLES: Record<string, string> = {
  default: "bg-canvas text-ink-soft",
  blue: "bg-blue-50 text-blue-700",
  green: "bg-brand-50 text-brand-700",
  amber: "bg-amber-50 text-amber-700",
  red: "bg-red-50 text-red-700",
  gray: "bg-slate-100 text-slate-600",
  brand: "bg-brand-500 text-white",
  ink: "bg-ink_inverted text-white",
};

export function Badge({
  children,
  tone = "default",
  className,
}: {
  children: ReactNode;
  tone?: keyof typeof BADGE_STYLES;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center px-2.5 h-6 text-xs font-medium rounded-full", BADGE_STYLES[tone], className)}>
      {children}
    </span>
  );
}

export function EmptyState({
  title,
  description,
  cta,
  icon,
}: {
  title: string;
  description?: string;
  cta?: { href: string; label: string };
  icon?: ReactNode;
}) {
  return (
    <div className="card flex flex-col items-center justify-center text-center p-12 gap-3">
      <span
        className="size-16 rounded-xl2 inline-flex items-center justify-center bg-gradient-to-br from-brand-100 to-brand-50 text-brand-700 shadow-card"
        aria-hidden
      >
        {icon || <DefaultEmptyIcon />}
      </span>
      <div className="text-base font-semibold tracking-tight">{title}</div>
      {description && <div className="text-sm text-ink-soft max-w-sm">{description}</div>}
      {cta && (
        <Link href={cta.href} className="btn-primary mt-3">
          {cta.label}
        </Link>
      )}
    </div>
  );
}

function DefaultEmptyIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

export function ListRow({
  href,
  primary,
  secondary,
  trailing,
}: {
  href: string;
  primary: ReactNode;
  secondary?: ReactNode;
  trailing?: ReactNode;
}) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between gap-3 px-5 py-4 hover:bg-canvas transition-colors"
    >
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium truncate">{primary}</div>
        {hasContent(secondary) && <div className="text-xs text-ink-soft truncate mt-0.5">{secondary}</div>}
      </div>
      {trailing && <div className="shrink-0">{trailing}</div>}
    </Link>
  );
}

const STAGE_TONE: Record<string, keyof typeof BADGE_STYLES> = {
  received: "gray",
  hr_review: "default",
  screening: "blue",
  submitted: "blue",
  shortlist: "green",
  interview: "amber",
  hold: "amber",
  offer: "green",
  joined: "green",
  rejected: "red",
};

export function StageBadge({ stage }: { stage: string }) {
  const label = stage.replaceAll("_", " ");
  return <Badge tone={STAGE_TONE[stage] || "default"}>{label}</Badge>;
}

const JOB_TONE: Record<string, keyof typeof BADGE_STYLES> = {
  open: "green",
  hold: "amber",
  closing: "amber",
  closed: "gray",
};

export function JobStatusBadge({ status }: { status: string }) {
  return <Badge tone={JOB_TONE[status] || "default"}>{status}</Badge>;
}
