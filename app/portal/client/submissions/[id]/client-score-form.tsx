"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { submitClientScoreAction } from "./score-actions";

const CRITERIA = ["technical", "cultural_fit", "communication"] as const;
const LABEL: Record<string, string> = { technical: "Technical fit", cultural_fit: "Cultural fit", communication: "Communication" };

export type ExistingScore = { overallScore: number; criteriaScores: Record<string, number>; comment: string | null };

export function ClientScoreForm({ submissionId, existing }: { submissionId: number; existing?: ExistingScore }) {
  const [overall, setOverall] = useState(existing?.overallScore ?? 0);
  const [criteria, setCriteria] = useState<Record<string, number>>(existing?.criteriaScores ?? {});
  const [pending, start] = useTransition();

  const submit = (formData: FormData) => {
    if (!overall) { toast.error("Pick an overall score."); return; }
    formData.set("overallScore", String(overall));
    for (const c of CRITERIA) if (criteria[c]) formData.set(c, String(criteria[c]));
    start(async () => {
      const r = await submitClientScoreAction(submissionId, formData);
      if (!r.ok) { toast.error(r.error || "Could not save."); return; }
      toast.success("Thanks — your feedback was sent to the recruiter.");
    });
  };

  const Stars = ({ value, onPick }: { value: number; onPick: (n: number) => void }) => (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" onClick={() => onPick(n)}
          className={`size-8 rounded-md border text-xs transition-colors ${value === n ? "bg-brand-500 text-white border-brand-500" : "bg-surface text-ink-soft border-hairline hover:bg-canvas"}`}>
          {n}
        </button>
      ))}
    </div>
  );

  return (
    <form action={submit} className="space-y-3">
      <div>
        <div className="text-xs text-ink-soft mb-1">Overall impression *</div>
        <Stars value={overall} onPick={setOverall} />
      </div>
      {CRITERIA.map((c) => (
        <div key={c}>
          <div className="text-xs text-ink-soft mb-1">{LABEL[c]}</div>
          <Stars value={criteria[c] || 0} onPick={(n) => setCriteria((p) => ({ ...p, [c]: n }))} />
        </div>
      ))}
      <textarea name="comment" rows={3} defaultValue={existing?.comment || ""} placeholder="Comments for the recruiter (optional)" className="input py-2 text-sm" />
      <button type="submit" disabled={pending} className="btn-primary text-sm">{pending ? "Saving…" : existing ? "Update feedback" : "Submit feedback"}</button>
    </form>
  );
}
