"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Badge } from "@/components/primitives";

export type MatchRow = {
  candidateId: number;
  fullName: string;
  currentTitle: string | null;
  experienceYears: string | null;
  skills: string[];
  score: number;
  reasons: string[];
  computedAt: string;
  cached: boolean;
};

type RefreshFn = () => Promise<{ ok: boolean; error?: string; rows?: MatchRow[] }>;

function scoreTone(score: number): "green" | "amber" | "default" {
  if (score >= 75) return "green";
  if (score >= 50) return "amber";
  return "default";
}

export function MatchPanel({
  initialRows,
  lastComputed,
  onRefresh,
}: {
  initialRows: MatchRow[];
  lastComputed: string | null;
  onRefresh: RefreshFn;
}) {
  const [rows, setRows] = useState(initialRows);
  const [computed, setComputed] = useState(lastComputed);
  const [pending, start] = useTransition();

  const refresh = () => {
    start(async () => {
      const r = await onRefresh();
      if (!r.ok) {
        toast.error(r.error || "Could not compute scores.");
        return;
      }
      setRows(r.rows || []);
      if (r.rows && r.rows[0]) setComputed(r.rows[0].computedAt);
      toast.success(`Scored ${r.rows?.length || 0} candidates.`);
    });
  };

  return (
    <section className="card p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-sm font-semibold">Recommended candidates</h3>
          {computed && (
            <p className="text-[11px] text-ink-muted">
              scored {new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }).format(new Date(computed))}
            </p>
          )}
        </div>
        <button type="button" onClick={refresh} disabled={pending} className="btn-ghost text-xs">
          {pending ? "Scoring…" : rows.length ? "Refresh" : "Score pool"}
        </button>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-ink-soft">
          {pending ? "Scoring candidates…" : "No scores yet. Click “Score pool” to rank candidates for this job."}
        </p>
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => (
            <li key={r.candidateId} className="rounded-lg border border-hairline p-3">
              <div className="flex items-center justify-between gap-2">
                <Link href={`/candidates/${r.candidateId}`} className="text-sm font-medium text-brand-700 hover:underline truncate">
                  {r.fullName}
                </Link>
                <Badge tone={scoreTone(r.score)}>{r.score}</Badge>
              </div>
              <div className="text-[11px] text-ink-muted mt-0.5 truncate">
                {[r.currentTitle, r.experienceYears ? `${r.experienceYears}y` : null].filter(Boolean).join(" · ") || "—"}
              </div>
              {r.reasons.length > 0 && (
                <ul className="mt-1.5 text-[11px] text-ink-soft list-disc pl-4 space-y-0.5">
                  {r.reasons.map((reason, i) => <li key={i}>{reason}</li>)}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}
      <p className="text-[11px] text-ink-muted mt-3">
        A skill prefilter narrows the pool, then AI scores the shortlist 0–100. Scores are cached until refreshed.
      </p>
    </section>
  );
}
