"use client";

import { useActionState } from "react";
import { vendorSignupAction, type VendorSignupResult } from "./actions";

export function VendorSignupForm() {
  const [state, action, pending] = useActionState<VendorSignupResult | null, FormData>(vendorSignupAction, null);

  if (state?.ok) {
    return (
      <div className="card p-8 text-center">
        <div className="text-3xl mb-2">✅</div>
        <h2 className="text-lg font-semibold">Application received</h2>
        <p className="text-sm text-ink-soft mt-2">Thanks for your interest. Our team will review your agency and be in touch.</p>
      </div>
    );
  }

  return (
    <form action={action} className="card p-6 space-y-4">
      <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
      <div>
        <label htmlFor="name" className="label">Agency name *</label>
        <input id="name" name="name" required maxLength={200} className="input" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="contactName" className="label">Contact name</label>
          <input id="contactName" name="contactName" maxLength={120} className="input" />
        </div>
        <div>
          <label htmlFor="contactEmail" className="label">Contact email *</label>
          <input id="contactEmail" name="contactEmail" type="email" required maxLength={254} className="input" />
        </div>
        <div>
          <label htmlFor="contactPhone" className="label">Phone</label>
          <input id="contactPhone" name="contactPhone" maxLength={40} className="input" />
        </div>
        <div>
          <label htmlFor="country" className="label">Country</label>
          <input id="country" name="country" maxLength={80} className="input" />
        </div>
      </div>
      <div>
        <label htmlFor="notes" className="label">Anything we should know?</label>
        <textarea id="notes" name="notes" rows={3} maxLength={1000} className="input py-2" />
      </div>
      {state && !state.ok && <div className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{state.error}</div>}
      <button type="submit" disabled={pending} className="btn-primary w-full">{pending ? "Submitting…" : "Apply to partner"}</button>
    </form>
  );
}
