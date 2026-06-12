"use client";

import { useActionState } from "react";
import { submitReferralAction, type ReferResult } from "./actions";

type JobOption = { id: number; title: string };

export function ReferForm({ openJobs }: { openJobs: JobOption[] }) {
  const [state, action, pending] = useActionState<ReferResult | null, FormData>(submitReferralAction, null);

  if (state?.ok) {
    return (
      <div className="card p-8 text-center">
        <div className="text-3xl mb-2">🙌</div>
        <h2 className="text-lg font-semibold">Referral submitted</h2>
        <p className="text-sm text-ink-soft mt-2">Thanks! Our recruiting team will take it from here.</p>
      </div>
    );
  }

  return (
    <form action={action} className="card p-6 space-y-4">
      <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="referrerName" className="label">Your name *</label>
          <input id="referrerName" name="referrerName" required maxLength={120} className="input" />
        </div>
        <div>
          <label htmlFor="referrerEmail" className="label">Your email *</label>
          <input id="referrerEmail" name="referrerEmail" type="email" required maxLength={254} className="input" />
        </div>
      </div>

      <div className="pt-2 border-t border-hairline">
        <div className="text-xs uppercase tracking-wide text-ink-muted mb-2">Candidate</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="fullName" className="label">Their name *</label>
            <input id="fullName" name="fullName" required maxLength={200} className="input" />
          </div>
          <div>
            <label htmlFor="email" className="label">Their email *</label>
            <input id="email" name="email" type="email" required maxLength={254} className="input" />
          </div>
          <div>
            <label htmlFor="phone" className="label">Their phone</label>
            <input id="phone" name="phone" maxLength={40} className="input" />
          </div>
          <div>
            <label htmlFor="jobId" className="label">For role (optional)</label>
            <select id="jobId" name="jobId" defaultValue="" className="input">
              <option value="">No specific role</option>
              {openJobs.map((j) => (
                <option key={j.id} value={j.id}>{j.title}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div>
        <label htmlFor="note" className="label">Why are they a good fit?</label>
        <textarea id="note" name="note" rows={3} maxLength={1000} className="input py-2" />
      </div>

      {state && !state.ok && (
        <div className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{state.error}</div>
      )}

      <button type="submit" disabled={pending} className="btn-primary w-full">
        {pending ? "Submitting…" : "Submit referral"}
      </button>
    </form>
  );
}
