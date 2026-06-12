"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

type JdFn = (input: {
  title: string; skills: string; location: string; workMode: string; experienceMin: string; experienceMax: string;
}) => Promise<{ ok: boolean; text?: string; error?: string }>;

type ScreenFn = (input: {
  title: string; skills: string; experienceMin: string; experienceMax: string;
}) => Promise<{ ok: boolean; text?: string; error?: string }>;

function val(id: string): string {
  const el = document.getElementById(id) as HTMLInputElement | HTMLTextAreaElement | null;
  return el?.value?.trim() || "";
}

export function JobAiButtons({
  jdEnabled,
  screeningEnabled,
  onGenerateJd,
  onGenerateScreening,
}: {
  jdEnabled: boolean;
  screeningEnabled: boolean;
  onGenerateJd: JdFn;
  onGenerateScreening: ScreenFn;
}) {
  const [pending, start] = useTransition();
  const [screening, setScreening] = useState<string | null>(null);

  if (!jdEnabled && !screeningEnabled) return null;

  const genJd = () => {
    start(async () => {
      const r = await onGenerateJd({
        title: val("title"),
        skills: val("skillsCsv"),
        location: val("location"),
        workMode: val("workMode"),
        experienceMin: val("experienceMin"),
        experienceMax: val("experienceMax"),
      });
      if (!r.ok || !r.text) {
        toast.error(r.error || "Could not generate.");
        return;
      }
      const ta = document.getElementById("description") as HTMLTextAreaElement | null;
      if (ta) {
        ta.value = r.text;
        ta.dispatchEvent(new Event("input", { bubbles: true }));
      }
      toast.success("Description drafted — review and edit before saving.");
    });
  };

  const genScreening = () => {
    start(async () => {
      const r = await onGenerateScreening({
        title: val("title"),
        skills: val("skillsCsv"),
        experienceMin: val("experienceMin"),
        experienceMax: val("experienceMax"),
      });
      if (!r.ok || !r.text) {
        toast.error(r.error || "Could not generate.");
        return;
      }
      setScreening(r.text);
      toast.success("Screening questions generated.");
    });
  };

  return (
    <div className="md:col-span-2 -mt-2">
      <div className="flex flex-wrap gap-2">
        {jdEnabled && (
          <button type="button" onClick={genJd} disabled={pending} className="btn-ghost text-xs">
            {pending ? "Working…" : "✨ Draft description with AI"}
          </button>
        )}
        {screeningEnabled && (
          <button type="button" onClick={genScreening} disabled={pending} className="btn-ghost text-xs">
            {pending ? "Working…" : "✨ Screening questions"}
          </button>
        )}
      </div>
      {screening && (
        <div className="mt-2 rounded-lg border border-hairline bg-canvas p-3">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-medium">Screening questions</span>
            <button
              type="button"
              className="text-[11px] text-brand-700 hover:underline"
              onClick={() => {
                navigator.clipboard?.writeText(screening).then(
                  () => toast.success("Copied"),
                  () => toast.error("Copy failed"),
                );
              }}
            >
              Copy
            </button>
          </div>
          <pre className="text-xs text-ink-soft whitespace-pre-wrap font-sans leading-relaxed">{screening}</pre>
        </div>
      )}
    </div>
  );
}
