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
        <h1 className="display text-display">{title}</h1>
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
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: "default" | "good" | "attention" | "info";
}) {
  const pillClass =
    tone === "good" ? "pill-good" : tone === "attention" ? "pill-attention" : tone === "info" ? "pill-info" : "pill-normal";
  const pillText = tone === "good" ? "GOOD" : tone === "attention" ? "ATTENTION" : tone === "info" ? "NORMAL" : null;
  return (
    <div className="card p-5 md:p-6">
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm text-ink-soft">{label}</div>
        {pillText && <span className={pillClass}>{pillText}</span>}
      </div>
      <div className="stat-big">{value}</div>
      {hint && <div className="mt-2 text-xs text-ink-soft">{hint}</div>}
    </div>
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
}: {
  title: string;
  description?: string;
  cta?: { href: string; label: string };
}) {
  return (
    <div className="card flex flex-col items-center justify-center text-center p-12 gap-2">
      <div className="text-base font-medium">{title}</div>
      {description && <div className="text-sm text-ink-soft max-w-sm">{description}</div>}
      {cta && (
        <Link href={cta.href} className="btn-primary mt-3">
          {cta.label}
        </Link>
      )}
    </div>
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
