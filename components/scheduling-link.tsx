"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

type CreateFn = (formData: FormData) => Promise<{ ok: boolean; url?: string; error?: string }>;

function guessTz(): string {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"; } catch { return "UTC"; }
}

export function SchedulingLink({ onCreate }: { onCreate: CreateFn }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [link, setLink] = useState<string | null>(null);

  const submit = (formData: FormData) => {
    formData.set("timeZone", guessTz());
    start(async () => {
      const r = await onCreate(formData);
      if (!r.ok || !r.url) { toast.error(r.error || "Could not create link."); return; }
      setLink(window.location.origin + r.url);
      toast.success("Scheduling link created — emailed to the candidate.");
      setOpen(false);
    });
  };

  return (
    <div className="space-y-2">
      {link && (
        <div className="rounded-lg border border-brand-200 bg-brand-50 p-2.5 text-xs">
          <div className="text-brand-900 font-medium mb-1">Self-scheduling link (also emailed):</div>
          <div className="flex items-center gap-2">
            <code className="break-all flex-1">{link}</code>
            <button type="button" className="text-brand-700 hover:underline shrink-0" onClick={() => navigator.clipboard?.writeText(link).then(() => toast.success("Copied"), () => {})}>Copy</button>
          </div>
        </div>
      )}
      {!open ? (
        <button type="button" onClick={() => setOpen(true)} className="btn-ghost text-xs w-full">+ Let candidate pick a slot</button>
      ) : (
        <form action={submit} className="space-y-2 rounded-lg border border-hairline p-3 bg-canvas">
          <input name="title" required defaultValue="Interview" placeholder="Title" className="input text-sm" />
          <div className="grid grid-cols-2 gap-2">
            <select name="mode" defaultValue="video" className="input text-sm">
              <option value="video">Video</option>
              <option value="phone">Phone</option>
              <option value="onsite">On-site</option>
            </select>
            <select name="durationMins" defaultValue="45" className="input text-sm">
              <option value="30">30 min</option>
              <option value="45">45 min</option>
              <option value="60">60 min</option>
            </select>
          </div>
          <textarea
            name="slots"
            required
            rows={4}
            placeholder={"One proposed slot per line (your timezone):\n2026-06-20T14:00\n2026-06-20T16:30\n2026-06-21T10:00"}
            className="input text-sm py-2 font-mono"
          />
          <div className="flex gap-2">
            <button type="submit" disabled={pending} className="btn-primary text-xs flex-1">{pending ? "Creating…" : "Create link"}</button>
            <button type="button" onClick={() => setOpen(false)} className="btn-ghost text-xs">Cancel</button>
          </div>
          <p className="text-[11px] text-ink-muted">The candidate picks one slot; it books the interview + sends invites.</p>
        </form>
      )}
    </div>
  );
}
