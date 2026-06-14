"use client";

import { useActionState } from "react";
import { applyToJobAction, type ApplyResult } from "./apply-actions";
import { DIVERSITY_FIELDS } from "@/lib/diversity";

export function ApplyForm({ jobId, collectDiversity = false }: { jobId: number; collectDiversity?: boolean }) {
  const [state, action, pending] = useActionState<ApplyResult | null, FormData>(applyToJobAction, null);

  if (state?.ok) {
    return (
      <div className="card p-8 text-center">
        <div className="text-3xl mb-2">✅</div>
        <h2 className="text-lg font-semibold">Application received</h2>
        <p className="text-sm text-ink-soft mt-2">
          Thanks for applying. Our recruiting team will review your profile and reach out if there&apos;s a fit.
        </p>
      </div>
    );
  }

  return (
    <form action={action} className="card p-6 space-y-4">
      <input type="hidden" name="jobId" value={jobId} />
      {/* Honeypot — hidden from humans, bots fill it */}
      <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />

      <div>
        <label htmlFor="fullName" className="label">Full name *</label>
        <input id="fullName" name="fullName" required maxLength={200} className="input" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="email" className="label">Email *</label>
          <input id="email" name="email" type="email" required maxLength={254} className="input" />
        </div>
        <div>
          <label htmlFor="phone" className="label">Phone</label>
          <input id="phone" name="phone" maxLength={40} className="input" />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="location" className="label">Location</label>
          <input id="location" name="location" maxLength={120} className="input" />
        </div>
        <div>
          <label htmlFor="linkedinUrl" className="label">LinkedIn</label>
          <input id="linkedinUrl" name="linkedinUrl" maxLength={254} placeholder="https://linkedin.com/in/…" className="input" />
        </div>
      </div>
      <div>
        <label htmlFor="file" className="label">Resume (PDF)</label>
        <input id="file" name="file" type="file" accept="application/pdf,.pdf" className="input file:mr-3 file:btn-ghost file:text-xs file:px-2 file:py-1 file:h-7 cursor-pointer" />
        <p className="text-xs text-ink-muted mt-1.5">Optional but recommended. Max 10 MB.</p>
      </div>

      {collectDiversity && (
        <details className="rounded-lg border border-hairline bg-canvas/50 px-4 py-3">
          <summary className="text-sm font-medium cursor-pointer select-none">
            Voluntary self-identification <span className="text-ink-muted font-normal">(optional)</span>
          </summary>
          <div className="mt-3 space-y-3">
            <p className="text-xs text-ink-muted leading-relaxed">
              We invite you to share the following to help us measure and improve the fairness of our
              hiring. It is entirely voluntary, never seen by hiring managers reviewing your application,
              and has no bearing on your candidacy. Leave any blank, or pick &ldquo;Prefer not to say.&rdquo;
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {DIVERSITY_FIELDS.map((f) => (
                <div key={f.key}>
                  <label htmlFor={`div-${f.key}`} className="label">{f.label}</label>
                  <select id={`div-${f.key}`} name={`diversity_${f.key}`} defaultValue="" className="input">
                    <option value="">—</option>
                    {f.options.map((o) => (
                      <option key={o} value={o}>{o}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
            <label className="flex items-start gap-2 text-xs">
              <input type="checkbox" name="diversityConsent" className="mt-0.5" />
              <span className="text-ink-soft">
                I consent to my voluntary self-identification being stored and used only in aggregate,
                anonymized diversity reporting.
              </span>
            </label>
          </div>
        </details>
      )}

      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" name="consent" className="mt-1" />
        <span className="text-ink-soft">
          I consent to {""}having my application data stored and processed for recruitment purposes.
        </span>
      </label>

      {state && !state.ok && (
        <div className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{state.error}</div>
      )}

      <button type="submit" disabled={pending} className="btn-primary w-full">
        {pending ? "Submitting…" : "Submit application"}
      </button>
    </form>
  );
}
