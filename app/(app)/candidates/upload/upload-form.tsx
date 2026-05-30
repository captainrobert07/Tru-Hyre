"use client";

import Link from "next/link";
import { useActionState } from "react";
import { uploadResumeAction } from "./actions";

type UploadResult = Awaited<ReturnType<typeof uploadResumeAction>>;

export function UploadForm() {
  const [state, formAction, pending] = useActionState(
    async (_prev: UploadResult | null, formData: FormData) => {
      const r = await uploadResumeAction(formData);
      return r ?? null;
    },
    null,
  );

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label htmlFor="file" className="label">PDF resume</label>
        <input id="file" name="file" type="file" accept="application/pdf,.pdf" required className="input file:mr-3 file:btn-ghost file:text-xs file:px-2 file:py-1 file:h-7 cursor-pointer" />
      </div>

      {state && state.ok === false && (
        <div className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{state.error}</div>
      )}

      {state && state.ok === true && state.duplicates && state.duplicates.length > 0 && (
        <div className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-1">
          <div className="font-medium">Possible duplicates detected:</div>
          <ul className="list-disc pl-5 text-xs space-y-0.5">
            {state.duplicates.map((d, i) => (
              <li key={i}>
                <Link href={`/candidates/${d.candidateId}`} className="underline">
                  {d.fullName}
                </Link>
                <span className="text-amber-700"> — matched on {d.reason}</span>
              </li>
            ))}
          </ul>
          <div className="text-xs">
            New record was created anyway.{" "}
            <Link href={`/candidates/${state.candidateId}`} className="underline font-medium">
              Open new candidate →
            </Link>
          </div>
        </div>
      )}

      <div className="flex gap-2">
        <button type="submit" disabled={pending} className="btn-primary">
          {pending ? "Uploading…" : "Upload"}
        </button>
        <Link href="/candidates" className="btn-ghost">Cancel</Link>
      </div>
    </form>
  );
}
