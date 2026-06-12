"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { uploadResumeAction, pasteResumeAction } from "./actions";

type UploadResult = Awaited<ReturnType<typeof uploadResumeAction>>;

export function UploadForm() {
  const [mode, setMode] = useState<"pdf" | "paste">("pdf");
  const [pdfState, pdfAction, pdfPending] = useActionState<UploadResult | null, FormData>(uploadResumeAction, null);
  const [pasteState, pasteAction, pastePending] = useActionState<UploadResult | null, FormData>(pasteResumeAction, null);
  const state = mode === "pdf" ? pdfState : pasteState;
  const pending = mode === "pdf" ? pdfPending : pastePending;

  return (
    <div className="space-y-4">
      <div className="inline-flex rounded-lg border border-hairline p-0.5 bg-canvas">
        <button
          type="button"
          onClick={() => setMode("pdf")}
          className={`px-3 h-8 text-xs rounded-md transition-colors ${mode === "pdf" ? "bg-surface shadow-card text-ink" : "text-ink-soft"}`}
        >
          Upload PDF
        </button>
        <button
          type="button"
          onClick={() => setMode("paste")}
          className={`px-3 h-8 text-xs rounded-md transition-colors ${mode === "paste" ? "bg-surface shadow-card text-ink" : "text-ink-soft"}`}
        >
          Paste text
        </button>
      </div>

      {mode === "pdf" ? (
        <form action={pdfAction} className="space-y-4">
          <div>
            <label htmlFor="file" className="label">PDF resume</label>
            <input
              id="file"
              name="file"
              type="file"
              accept="application/pdf,.pdf"
              required
              className="input file:mr-3 file:btn-ghost file:text-xs file:px-2 file:py-1 file:h-7 cursor-pointer"
            />
            <p className="text-xs text-ink-muted mt-1.5">Max 10 MB. Tru Hyre extracts name, contact, location, title, company, experience, notice, CTC, summary, and skills.</p>
          </div>
          <SourceFields />
          <Result state={state} />
          <div className="flex gap-2">
            <button type="submit" disabled={pending} className="btn-primary">
              {pending ? "Uploading…" : "Upload"}
            </button>
            <Link href="/candidates" className="btn-ghost">Cancel</Link>
          </div>
        </form>
      ) : (
        <form action={pasteAction} className="space-y-4">
          <div>
            <label htmlFor="text" className="label">Resume text</label>
            <textarea
              id="text"
              name="text"
              required
              rows={14}
              className="input py-2 font-mono text-xs leading-relaxed"
              placeholder="Paste the resume content here…&#10;&#10;Tip: from a PDF, press Ctrl-A then Ctrl-C inside the document and paste."
            />
            <p className="text-xs text-ink-muted mt-1.5">No file is stored. Tru Hyre runs the same extractor over the text you paste.</p>
          </div>
          <SourceFields />
          <Result state={state} />
          <div className="flex gap-2">
            <button type="submit" disabled={pending} className="btn-primary">
              {pending ? "Saving…" : "Create candidate"}
            </button>
            <Link href="/candidates" className="btn-ghost">Cancel</Link>
          </div>
        </form>
      )}
    </div>
  );
}

const SOURCE_OPTIONS: { value: string; label: string }[] = [
  { value: "direct", label: "Direct (HR upload)" },
  { value: "referral", label: "Referral" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "job_board", label: "Job board" },
  { value: "agency", label: "Agency / vendor" },
  { value: "careers", label: "Careers page" },
  { value: "other", label: "Other" },
];

function SourceFields() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <div>
        <label htmlFor="source" className="label">Source</label>
        <select id="source" name="source" defaultValue="direct" className="input text-sm">
          {SOURCE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="sourceDetail" className="label">Source detail <span className="text-ink-muted font-normal">(optional)</span></label>
        <input id="sourceDetail" name="sourceDetail" maxLength={160} placeholder="Referrer name, board, etc." className="input text-sm" />
      </div>
    </div>
  );
}

function Result({ state }: { state: UploadResult | null }) {
  if (!state) return null;
  if (state.ok === false) {
    return <div className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{state.error}</div>;
  }
  if (state.duplicates.length > 0) {
    return (
      <div className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-1">
        <div className="font-medium">Possible duplicates detected:</div>
        <ul className="list-disc pl-5 text-xs space-y-0.5">
          {state.duplicates.map((d, i) => (
            <li key={i}>
              <Link href={`/candidates/${d.candidateId}`} className="underline">{d.fullName}</Link>
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
    );
  }
  return null;
}
