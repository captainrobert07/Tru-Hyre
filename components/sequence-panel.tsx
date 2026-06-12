"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/primitives";

export type EnrollmentItem = {
  id: number;
  sequenceKey: string;
  sequenceLabel: string;
  stepIndex: number;
  totalSteps: number;
  status: string;
};
export type SequenceOption = { key: string; label: string };

type EnrollFn = (key: string) => Promise<{ ok: boolean; error?: string }>;
type CancelFn = (enrollmentId: number) => Promise<{ ok: boolean }>;

export function SequencePanel({
  enrollments,
  sequences,
  onEnroll,
  onCancel,
}: {
  enrollments: EnrollmentItem[];
  sequences: SequenceOption[];
  onEnroll: EnrollFn;
  onCancel: CancelFn;
}) {
  const [pending, start] = useTransition();

  const enroll = (key: string) => {
    if (!key) return;
    start(async () => {
      const r = await onEnroll(key);
      if (!r.ok) { toast.error(r.error || "Could not enroll."); return; }
      toast.success("Enrolled in sequence.");
    });
  };
  const cancel = (id: number) => {
    start(async () => {
      await onCancel(id);
      toast.success("Sequence cancelled.");
    });
  };

  return (
    <div className="space-y-3">
      {enrollments.length === 0 ? (
        <p className="text-sm text-ink-soft">Not in any sequence.</p>
      ) : (
        <ul className="space-y-2">
          {enrollments.map((e) => (
            <li key={e.id} className="rounded-lg border border-hairline p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium truncate">{e.sequenceLabel}</span>
                <Badge tone={e.status === "active" ? "blue" : e.status === "done" ? "green" : "default"}>{e.status}</Badge>
              </div>
              <div className="text-[11px] text-ink-muted mt-1">step {Math.min(e.stepIndex + 1, e.totalSteps)} of {e.totalSteps}</div>
              {e.status === "active" && (
                <button type="button" disabled={pending} onClick={() => cancel(e.id)} className="text-[11px] text-red-700 hover:underline mt-1 disabled:opacity-50">
                  Cancel
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {sequences.length > 0 && (
        <select
          defaultValue=""
          disabled={pending}
          onChange={(e) => { enroll(e.target.value); e.currentTarget.value = ""; }}
          className="input text-sm"
        >
          <option value="" disabled>Enroll in sequence…</option>
          {sequences.map((s) => (
            <option key={s.key} value={s.key}>{s.label}</option>
          ))}
        </select>
      )}
    </div>
  );
}
