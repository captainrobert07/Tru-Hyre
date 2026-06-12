"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Badge } from "@/components/primitives";

type Hit = {
  id: number;
  fullName: string;
  currentTitle: string | null;
  location: string | null;
  experienceYears: string | null;
  skills: string[];
  stage: string;
  matchedSkills: string[];
};
type Criteria = { skills: string[]; minExperience: number | null; location: string | null; keywords: string[] };
type Result = { criteria: Criteria; hits: Hit[]; usedAi: boolean };

type SearchFn = (query: string) => Promise<{ ok: boolean; result?: Result; error?: string }>;

const EXAMPLES = [
  "Senior Java engineers in Bangalore, 8+ years, Kafka experience",
  "Frontend devs who know React and TypeScript open to relocation",
  "Data engineers with Spark and Airflow, 5+ years",
];

export function AiSearch({ onSearch }: { onSearch: SearchFn }) {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [pending, start] = useTransition();

  const run = (q: string) => {
    if (q.trim().length < 3) return;
    start(async () => {
      const r = await onSearch(q);
      if (!r.ok || !r.result) {
        toast.error(r.error || "Search failed.");
        return;
      }
      setResult(r.result);
    });
  };

  return (
    <div className="space-y-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          run(query);
        }}
        className="card p-4"
      >
        <textarea
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          rows={2}
          placeholder="Describe who you're looking for, in plain English…"
          className="input text-sm py-2"
        />
        <div className="flex items-center justify-between mt-2 gap-2">
          <div className="flex flex-wrap gap-1.5">
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                type="button"
                onClick={() => { setQuery(ex); run(ex); }}
                className="text-[11px] px-2 h-6 rounded-full bg-canvas border border-hairline text-ink-soft hover:bg-surface"
              >
                {ex.length > 38 ? ex.slice(0, 38) + "…" : ex}
              </button>
            ))}
          </div>
          <button type="submit" disabled={pending} className="btn-primary text-xs shrink-0">
            {pending ? "Searching…" : "Search"}
          </button>
        </div>
      </form>

      {result && (
        <>
          <div className="flex flex-wrap items-center gap-2 text-xs text-ink-soft">
            <span>Interpreted as:</span>
            {result.criteria.skills.map((s) => <Badge key={s} tone="blue">{s}</Badge>)}
            {result.criteria.minExperience != null && <Badge tone="default">{result.criteria.minExperience}+ yrs</Badge>}
            {result.criteria.location && <Badge tone="default">{result.criteria.location}</Badge>}
            {!result.usedAi && <Badge tone="amber">keyword fallback (AI off)</Badge>}
          </div>

          {result.hits.length === 0 ? (
            <div className="card p-8 text-center text-sm text-ink-muted">No matching candidates.</div>
          ) : (
            <div className="card divide-y divide-hairline">
              {result.hits.map((h) => (
                <Link key={h.id} href={`/candidates/${h.id}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-canvas transition-colors">
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{h.fullName}</div>
                    <div className="text-xs text-ink-soft truncate">
                      {[h.currentTitle, h.location, h.experienceYears ? `${h.experienceYears}y` : null].filter(Boolean).join(" · ") || "—"}
                    </div>
                    {h.matchedSkills.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {h.matchedSkills.map((s) => <Badge key={s} tone="green">{s}</Badge>)}
                      </div>
                    )}
                  </div>
                  <Badge tone="default">{h.stage.replaceAll("_", " ")}</Badge>
                </Link>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
