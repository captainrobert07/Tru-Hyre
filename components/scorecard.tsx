"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/primitives";

export type ScorecardItem = {
  id: number;
  verdict: "strong_yes" | "yes" | "no" | "strong_no";
  scores: Record<string, number>;
  body: string | null;
  reviewerName: string;
  createdAt: string;
};

export type SubmissionOption = { id: number; jobId: number; label: string };
export type InterviewOption = { id: number; label: string };

type SubmitFn = (formData: FormData) => Promise<{ ok: boolean; error?: string }>;

const CRITERIA = ["technical", "communication", "culture"] as const;
const CRITERION_LABEL: Record<string, string> = {
  technical: "Technical",
  communication: "Communication",
  culture: "Culture fit",
};
const VERDICTS: { value: ScorecardItem["verdict"]; label: string; tone: "green" | "amber" | "red" }[] = [
  { value: "strong_yes", label: "Strong yes", tone: "green" },
  { value: "yes", label: "Yes", tone: "green" },
  { value: "no", label: "No", tone: "red" },
  { value: "strong_no", label: "Strong no", tone: "red" },
];
const VERDICT_META: Record<string, { label: string; tone: "green" | "amber" | "red" }> = {
  strong_yes: { label: "Strong yes", tone: "green" },
  yes: { label: "Yes", tone: "green" },
  no: { label: "No", tone: "red" },
  strong_no: { label: "Strong no", tone: "red" },
};

function avgOf(scores: Record<string, number>): string {
  const vals = Object.values(scores);
  if (!vals.length) return "—";
  return (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1);
}

export function Scorecard({
  scorecards,
  submissions,
  interviews,
  onSubmit,
}: {
  scorecards: ScorecardItem[];
  submissions: SubmissionOption[];
  interviews: InterviewOption[];
  onSubmit: SubmitFn;
}) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [verdict, setVerdict] = useState<ScorecardItem["verdict"] | "">("");

  const submit = (formData: FormData) => {
    if (!verdict) {
      toast.error("Pick an overall verdict.");
      return;
    }
    for (const c of CRITERIA) if (ratings[c]) formData.set(c, String(ratings[c]));
    formData.set("verdict", verdict);
    start(async () => {
      const r = await onSubmit(formData);
      if (!r.ok) {
        toast.error(r.error || "Could not save scorecard.");
        return;
      }
      toast.success("Scorecard saved.");
      setOpen(false);
      setRatings({});
      setVerdict("");
    });
  };

  return (
    <div className="space-y-3">
      {scorecards.length === 0 ? (
        <p className="text-sm text-ink-soft">No scorecards yet.</p>
      ) : (
        <ul className="space-y-2">
          {scorecards.map((s) => {
            const meta = VERDICT_META[s.verdict];
            return (
              <li key={s.id} className="rounded-lg border border-hairline p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium truncate">{s.reviewerName}</span>
                  <Badge tone={meta.tone}>{meta.label}</Badge>
                </div>
                <div className="flex flex-wrap gap-2 mt-1.5 text-[11px] text-ink-soft">
                  <span className="font-medium text-ink">avg {avgOf(s.scores)}/5</span>
                  {Object.entries(s.scores).map(([k, val]) => (
                    <span key={k}>{CRITERION_LABEL[k] || k}: {val}</span>
                  ))}
                </div>
                {s.body && <p className="text-xs text-ink-soft mt-1.5 whitespace-pre-line">{s.body}</p>}
              </li>
            );
          })}
        </ul>
      )}

      {!open ? (
        <button type="button" onClick={() => setOpen(true)} className="btn-ghost text-xs w-full">
          + Add scorecard
        </button>
      ) : (
        <form action={submit} className="space-y-3 rounded-lg border border-hairline p-3 bg-canvas">
          {CRITERIA.map((c) => (
            <div key={c}>
              <div className="text-xs text-ink-soft mb-1">{CRITERION_LABEL[c]}</div>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setRatings((r) => ({ ...r, [c]: n }))}
                    className={`size-8 rounded-md border text-xs transition-colors ${
                      ratings[c] === n
                        ? "bg-brand-500 text-white border-brand-500"
                        : "bg-surface text-ink-soft border-hairline hover:bg-canvas"
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
          ))}

          <div>
            <div className="text-xs text-ink-soft mb-1">Overall</div>
            <div className="flex flex-wrap gap-1.5">
              {VERDICTS.map((vd) => (
                <button
                  key={vd.value}
                  type="button"
                  onClick={() => setVerdict(vd.value)}
                  className={`text-xs px-2.5 h-7 rounded-md border transition-colors ${
                    verdict === vd.value
                      ? vd.tone === "green"
                        ? "bg-brand-50 text-brand-700 border-brand-200"
                        : "bg-red-50 text-red-700 border-red-200"
                      : "bg-surface text-ink-soft border-hairline hover:bg-canvas"
                  }`}
                >
                  {vd.label}
                </button>
              ))}
            </div>
          </div>

          {submissions.length > 0 && (
            <select name="submissionId" className="input text-sm" defaultValue="">
              <option value="">Link to submission (optional)…</option>
              {submissions.map((s) => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </select>
          )}
          {interviews.length > 0 && (
            <select name="interviewId" className="input text-sm" defaultValue="">
              <option value="">Link to interview (optional)…</option>
              {interviews.map((i) => (
                <option key={i.id} value={i.id}>{i.label}</option>
              ))}
            </select>
          )}

          <textarea name="body" rows={3} placeholder="Notes (optional)" className="input text-sm py-2" aria-label="Scorecard notes" />

          <div className="flex gap-2">
            <button type="submit" disabled={pending} className="btn-primary text-xs flex-1">
              {pending ? "Saving…" : "Save scorecard"}
            </button>
            <button type="button" onClick={() => setOpen(false)} disabled={pending} className="btn-ghost text-xs">
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
