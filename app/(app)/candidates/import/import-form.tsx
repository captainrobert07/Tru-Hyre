"use client";

import Link from "next/link";
import { useActionState } from "react";
import { importCandidatesCsvAction, type ImportResult } from "./actions";

export function ImportForm() {
  const [state, formAction, pending] = useActionState<ImportResult | null, FormData>(
    async (_prev, formData) => importCandidatesCsvAction(formData),
    null,
  );

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label htmlFor="file" className="label">CSV file</label>
        <input
          id="file"
          name="file"
          type="file"
          accept=".csv,text/csv"
          required
          className="input file:mr-3 file:btn-ghost file:text-xs file:px-2 file:py-1 file:h-7 cursor-pointer"
        />
        <p className="text-xs text-ink-muted mt-1.5">
          Max 5 MB. Header row required. Up to ~5000 rows per import.
        </p>
      </div>

      {state && state.ok === false && (
        <div className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-xl2 px-3 py-2">
          {state.error}
        </div>
      )}

      {state && state.ok && (
        <div className="text-sm bg-brand-50 border border-brand-100 rounded-xl2 px-3 py-2.5 space-y-1.5">
          <div className="font-medium text-brand-900">
            Imported {state.imported} candidate{state.imported === 1 ? "" : "s"}
            {state.skipped > 0 && (
              <span className="text-amber-700"> · {state.skipped} skipped</span>
            )}
          </div>
          {state.errors.length > 0 && (
            <details className="text-xs">
              <summary className="cursor-pointer text-amber-800">First {state.errors.length} errors</summary>
              <ul className="mt-1.5 space-y-0.5 font-mono">
                {state.errors.map((e, i) => (
                  <li key={i}>row {e.row}: {e.reason}</li>
                ))}
              </ul>
            </details>
          )}
          {state.imported > 0 && (
            <Link href="/candidates" className="inline-block text-xs text-brand-700 hover:underline">
              See them in the candidates list →
            </Link>
          )}
        </div>
      )}

      <div className="flex gap-2">
        <button type="submit" disabled={pending} className="btn-primary">
          {pending ? "Importing…" : "Import"}
        </button>
        <Link href="/candidates" className="btn-ghost">Cancel</Link>
      </div>
    </form>
  );
}
