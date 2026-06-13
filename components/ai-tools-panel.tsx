"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

type GenFn = () => Promise<{ ok: boolean; text?: string; error?: string }>;

export function AiToolsPanel({
  outreach,
  redflags,
}: {
  outreach?: GenFn;
  redflags?: GenFn;
}) {
  const [pending, start] = useTransition();
  const [out, setOut] = useState<string | null>(null);
  const [flags, setFlags] = useState<string | null>(null);

  const run = (fn: GenFn, set: (v: string) => void, label: string) => {
    start(async () => {
      const r = await fn();
      if (!r.ok || !r.text) { toast.error(r.error || "Failed."); return; }
      set(r.text);
      toast.success(`${label} ready.`);
    });
  };

  const copy = (text: string) =>
    navigator.clipboard?.writeText(text).then(() => toast.success("Copied"), () => toast.error("Copy failed"));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {outreach && (
          <button type="button" disabled={pending} onClick={() => run(outreach, setOut, "Outreach draft")} className="btn-ghost text-xs">
            ✨ Draft outreach
          </button>
        )}
        {redflags && (
          <button type="button" disabled={pending} onClick={() => run(redflags, setFlags, "Red-flag scan")} className="btn-ghost text-xs">
            ✨ Red-flag scan
          </button>
        )}
      </div>
      {out && (
        <div className="rounded-lg border border-hairline bg-canvas p-3">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-medium">Outreach draft</span>
            <button type="button" className="text-[11px] text-brand-700 hover:underline" onClick={() => copy(out)}>Copy</button>
          </div>
          <pre className="text-xs text-ink-soft whitespace-pre-wrap font-sans leading-relaxed">{out}</pre>
        </div>
      )}
      {flags && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
          <div className="text-xs font-medium text-amber-900 mb-1.5">Red-flag scan</div>
          <pre className="text-xs text-amber-900 whitespace-pre-wrap font-sans leading-relaxed">{flags}</pre>
        </div>
      )}
    </div>
  );
}
