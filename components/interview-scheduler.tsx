"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/primitives";

export type InterviewItem = {
  id: number;
  title: string;
  mode: "video" | "phone" | "onsite";
  scheduledStart: string; // ISO
  scheduledEnd: string; // ISO
  location: string | null;
  meetLink: string | null;
  status: "scheduled" | "completed" | "no_show" | "cancelled";
  interviewerNames: string[];
  roundLabel?: string | null;
  roundIndex?: number | null;
  notes?: string | null;
};

export type InterviewerOption = { id: number; name: string };
export type SubmissionOption = { id: number; jobId: number; label: string };

type ScheduleFn = (formData: FormData) => Promise<{ ok: boolean; error?: string; meetLink?: string | null }>;
type CancelFn = (interviewId: number) => Promise<{ ok: boolean; error?: string }>;

const MODE_LABEL: Record<InterviewItem["mode"], string> = {
  video: "Video",
  phone: "Phone",
  onsite: "On-site",
};

function fmt(iso: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      weekday: "short", day: "numeric", month: "short",
      hour: "numeric", minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

// Default the picker to the next round hour, formatted for datetime-local.
function defaultStart(): string {
  const d = new Date();
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + 1);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function guessTz(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

export function InterviewScheduler({
  interviews,
  interviewers,
  submissions,
  onSchedule,
  onCancel,
}: {
  interviews: InterviewItem[];
  interviewers: InterviewerOption[];
  submissions: SubmissionOption[];
  onSchedule: ScheduleFn;
  onCancel: CancelFn;
}) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [selected, setSelected] = useState<number[]>([]);

  const now = Date.now();
  const upcoming = interviews
    .filter((i) => i.status === "scheduled" && new Date(i.scheduledStart).getTime() >= now)
    .sort((a, b) => new Date(a.scheduledStart).getTime() - new Date(b.scheduledStart).getTime());
  const past = interviews
    .filter((i) => i.status !== "scheduled" || new Date(i.scheduledStart).getTime() < now)
    .sort((a, b) => new Date(b.scheduledStart).getTime() - new Date(a.scheduledStart).getTime());

  const toggle = (id: number) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const submit = (formData: FormData) => {
    formData.set("timeZone", guessTz());
    formData.set("interviewerIds", selected.join(","));
    start(async () => {
      const r = await onSchedule(formData);
      if (!r.ok) {
        toast.error(r.error || "Could not schedule interview.");
        return;
      }
      toast.success(r.meetLink ? "Interview scheduled — Meet link created." : "Interview scheduled.");
      setOpen(false);
      setSelected([]);
    });
  };

  const cancel = (id: number) => {
    if (!window.confirm("Cancel this interview? The calendar invite will be withdrawn.")) return;
    start(async () => {
      const r = await onCancel(id);
      if (!r.ok) {
        toast.error(r.error || "Could not cancel.");
        return;
      }
      toast.success("Interview cancelled.");
    });
  };

  return (
    <div className="space-y-3">
      {upcoming.length === 0 && past.length === 0 && !open && (
        <p className="text-sm text-ink-soft">No interviews scheduled.</p>
      )}

      {upcoming.length > 0 && (
        <ul className="space-y-2">
          {upcoming.map((i) => (
            <li key={i.id} className="rounded-lg border border-hairline p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">
                    {i.roundIndex && i.roundIndex > 1 ? <span className="text-ink-muted font-normal">R{i.roundIndex} · </span> : null}
                    {i.title}{i.roundLabel ? <span className="text-ink-muted font-normal"> · {i.roundLabel}</span> : null}
                  </div>
                  <div className="text-xs text-ink-soft mt-0.5">{fmt(i.scheduledStart)}</div>
                </div>
                <Badge tone="amber">{MODE_LABEL[i.mode]}</Badge>
              </div>
              {i.interviewerNames.length > 0 && (
                <div className="text-[11px] text-ink-muted mt-1.5 truncate">
                  With {i.interviewerNames.join(", ")}
                </div>
              )}
              {i.notes && (
                <div className="text-[11px] text-ink-soft mt-1.5 whitespace-pre-line line-clamp-3">{i.notes}</div>
              )}
              <div className="flex items-center gap-3 mt-2">
                {i.mode === "video" && i.meetLink && (
                  <a href={i.meetLink} target="_blank" rel="noopener noreferrer" className="text-xs text-brand-700 hover:underline">
                    Join Meet ↗
                  </a>
                )}
                {i.mode === "onsite" && i.location && (
                  <span className="text-[11px] text-ink-muted truncate">{i.location}</span>
                )}
                <button
                  type="button"
                  onClick={() => cancel(i.id)}
                  disabled={pending}
                  className="text-xs text-red-700 hover:underline disabled:opacity-50 ml-auto"
                >
                  Cancel
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {!open ? (
        <button type="button" onClick={() => setOpen(true)} className="btn-ghost text-xs w-full">
          + Schedule interview
        </button>
      ) : (
        <form action={submit} className="space-y-2 rounded-lg border border-hairline p-3 bg-canvas">
          <input name="title" required placeholder="e.g. Technical round 1" className="input text-sm" defaultValue="Interview" aria-label="Interview title" />
          <div className="grid grid-cols-[1fr_5rem] gap-2">
            <input name="roundLabel" placeholder="Round label (optional, e.g. Tech round 1)" className="input text-sm" aria-label="Round label" />
            <input name="roundIndex" type="number" min={1} max={20} placeholder="Round #" title="Round number" className="input text-sm" aria-label="Round number" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <select name="mode" className="input text-sm" defaultValue="video" aria-label="Interview mode">
              <option value="video">Video</option>
              <option value="phone">Phone</option>
              <option value="onsite">On-site</option>
            </select>
            <select name="durationMins" className="input text-sm" defaultValue="45" aria-label="Duration">
              <option value="15">15 min</option>
              <option value="30">30 min</option>
              <option value="45">45 min</option>
              <option value="60">60 min</option>
              <option value="90">90 min</option>
            </select>
          </div>
          <input name="start" type="datetime-local" required defaultValue={defaultStart()} className="input text-sm" aria-label="Start date and time" />
          <input name="location" placeholder="Location (for on-site)" className="input text-sm" aria-label="Location" />
          {submissions.length > 0 && (
            <select name="submissionId" className="input text-sm" defaultValue="" aria-label="Link to a submission">
              <option value="">Link to a submission (optional)…</option>
              {submissions.map((s) => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </select>
          )}
          {interviewers.length > 0 && (
            <div className="rounded-md border border-hairline bg-surface p-2">
              <div className="text-[11px] text-ink-muted mb-1.5">Interviewers</div>
              <div className="flex flex-wrap gap-1">
                {interviewers.map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => toggle(u.id)}
                    className={`text-xs px-2 h-7 rounded-md border transition-colors ${
                      selected.includes(u.id)
                        ? "bg-brand-50 text-brand-700 border-brand-100"
                        : "bg-canvas text-ink-soft border-hairline hover:bg-surface"
                    }`}
                  >
                    {u.name}
                  </button>
                ))}
              </div>
            </div>
          )}
          <textarea name="notes" rows={2} placeholder="Notes (optional)" className="input text-sm py-2" aria-label="Interview notes" />
          <div className="flex gap-2">
            <button type="submit" disabled={pending} className="btn-primary text-xs flex-1">
              {pending ? "Scheduling…" : "Schedule"}
            </button>
            <button type="button" onClick={() => setOpen(false)} disabled={pending} className="btn-ghost text-xs">
              Cancel
            </button>
          </div>
          <p className="text-[11px] text-ink-muted">
            Sends a calendar invite + email to the candidate{interviewers.length > 0 ? " and selected interviewers" : ""}. Video interviews get a Meet link.
          </p>
        </form>
      )}

      {past.length > 0 && (
        <details className="text-xs">
          <summary className="cursor-pointer text-ink-muted hover:text-ink-soft select-none">
            Past &amp; cancelled ({past.length})
          </summary>
          <ul className="mt-2 space-y-1.5">
            {past.map((i) => (
              <li key={i.id} className="flex items-center justify-between gap-2 text-ink-soft">
                <span className="truncate">{i.title} · {fmt(i.scheduledStart)}</span>
                <Badge tone={i.status === "cancelled" ? "red" : "default"}>{i.status.replace("_", " ")}</Badge>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
