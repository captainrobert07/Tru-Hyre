"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/primitives";

export type OutboxItem = {
  id: number;
  templateSlug: string;
  subject: string;
  toEmail: string;
  status: string;
  error: string | null;
  sentAt: string | null;
  createdAt: string;
};

export type TemplateOption = { slug: string; name: string };
export type InboundItem = { id: number; subject: string | null; body: string; receivedAt: string };

type SendFn = (formData: FormData) => Promise<{ ok: boolean; error?: string }>;
type LogReplyFn = (formData: FormData) => Promise<{ ok: boolean; error?: string }>;

function fmt(iso: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      day: "numeric", month: "short", hour: "numeric", minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function EmailComposer({
  candidateEmail,
  outbox,
  templates,
  onSend,
  inbound = [],
  onLogReply,
}: {
  candidateEmail: string | null;
  outbox: OutboxItem[];
  templates: TemplateOption[];
  onSend: SendFn;
  inbound?: InboundItem[];
  onLogReply?: LogReplyFn;
}) {
  const [open, setOpen] = useState(false);
  const [replyOpen, setReplyOpen] = useState(false);
  const [mode, setMode] = useState<"template" | "custom">(templates.length > 0 ? "template" : "custom");
  const [pending, start] = useTransition();

  const logReply = (formData: FormData) => {
    if (!onLogReply) return;
    start(async () => {
      const r = await onLogReply(formData);
      if (!r.ok) { toast.error(r.error || "Could not log reply."); return; }
      toast.success("Reply logged.");
      setReplyOpen(false);
    });
  };

  const submit = (formData: FormData) => {
    if (mode === "template") formData.delete("subject"), formData.delete("body");
    else formData.delete("templateSlug");
    start(async () => {
      const r = await onSend(formData);
      if (!r.ok) {
        toast.error(r.error || "Could not send.");
        return;
      }
      toast.success("Email sent.");
      setOpen(false);
    });
  };

  return (
    <div className="space-y-3">
      {!candidateEmail && (
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
          No email address on file — add one to send.
        </p>
      )}

      {outbox.length === 0 ? (
        <p className="text-sm text-ink-soft">No emails sent yet.</p>
      ) : (
        <ul className="space-y-1.5">
          {outbox.map((m) => (
            <li key={m.id} className="flex items-start justify-between gap-2 text-sm border-b border-hairline pb-1.5 last:border-0">
              <div className="min-w-0">
                <div className="truncate font-medium">{m.subject}</div>
                <div className="text-[11px] text-ink-muted">
                  {m.templateSlug.replace(/^adhoc:/, "").replace(/^stage:/, "stage · ").replace("interview:scheduled", "interview")} · {fmt(m.sentAt || m.createdAt)}
                </div>
                {m.status === "failed" && m.error && (
                  <div className="text-[11px] text-red-600 mt-0.5">failed: {m.error}</div>
                )}
              </div>
              <Badge tone={m.status === "sent" ? "green" : m.status === "failed" ? "red" : "default"}>{m.status}</Badge>
            </li>
          ))}
        </ul>
      )}

      {inbound.length > 0 && (
        <div className="rounded-lg border border-hairline bg-canvas p-2.5">
          <div className="text-[11px] font-medium text-ink-muted mb-1.5">Replies received</div>
          <ul className="space-y-1.5">
            {inbound.map((m) => (
              <li key={m.id} className="text-sm border-b border-hairline pb-1.5 last:border-0">
                {m.subject && <div className="font-medium truncate">{m.subject}</div>}
                <div className="text-xs text-ink-soft whitespace-pre-line line-clamp-4">{m.body}</div>
                <div className="text-[11px] text-ink-muted mt-0.5">← inbound · {fmt(m.receivedAt)}</div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {onLogReply && (
        replyOpen ? (
          <form action={logReply} className="space-y-2 rounded-lg border border-hairline p-3 bg-canvas">
            <input name="subject" placeholder="Subject (optional)" maxLength={240} className="input text-sm" aria-label="Reply subject" />
            <textarea name="body" rows={3} required placeholder="Paste the candidate's reply…" className="input text-sm py-2" aria-label="Logged reply body" />
            <div className="flex gap-2">
              <button type="submit" disabled={pending} className="btn-primary text-xs flex-1">{pending ? "Saving…" : "Log reply"}</button>
              <button type="button" onClick={() => setReplyOpen(false)} className="btn-ghost text-xs">Cancel</button>
            </div>
          </form>
        ) : (
          <button type="button" onClick={() => setReplyOpen(true)} className="btn-ghost text-xs w-full">＋ Log a reply</button>
        )
      )}

      {candidateEmail && (
        !open ? (
          <button type="button" onClick={() => setOpen(true)} className="btn-ghost text-xs w-full">
            ✉ Send email
          </button>
        ) : (
          <form action={submit} className="space-y-2 rounded-lg border border-hairline p-3 bg-canvas">
            <div className="inline-flex rounded-lg border border-hairline p-0.5 bg-surface">
              <button
                type="button"
                onClick={() => setMode("template")}
                disabled={templates.length === 0}
                className={`px-3 h-7 text-xs rounded-md transition-colors disabled:opacity-40 ${mode === "template" ? "bg-canvas shadow-card text-ink" : "text-ink-soft"}`}
              >
                Template
              </button>
              <button
                type="button"
                onClick={() => setMode("custom")}
                className={`px-3 h-7 text-xs rounded-md transition-colors ${mode === "custom" ? "bg-canvas shadow-card text-ink" : "text-ink-soft"}`}
              >
                Custom
              </button>
            </div>

            {mode === "template" ? (
              <select name="templateSlug" required className="input text-sm" defaultValue="">
                <option value="" disabled>Choose a template…</option>
                {templates.map((t) => (
                  <option key={t.slug} value={t.slug}>{t.name}</option>
                ))}
              </select>
            ) : (
              <>
                <input name="subject" placeholder="Subject" maxLength={240} className="input text-sm" aria-label="Email subject" />
                <textarea
                  name="body"
                  rows={6}
                  maxLength={8000}
                  placeholder={"Message…\n\nTokens like {{candidate.firstName}} are filled in automatically."}
                  className="input text-sm py-2"
                  aria-label="Email body"
                />
              </>
            )}

            <div className="flex gap-2">
              <button type="submit" disabled={pending} className="btn-primary text-xs flex-1">
                {pending ? "Sending…" : `Send to ${candidateEmail}`}
              </button>
              <button type="button" onClick={() => setOpen(false)} disabled={pending} className="btn-ghost text-xs">
                Cancel
              </button>
            </div>
            <p className="text-[11px] text-ink-muted">
              The send is logged here and in the audit trail. Replies go to the shared recruiting mailbox.
            </p>
          </form>
        )
      )}
    </div>
  );
}
