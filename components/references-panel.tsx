"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/primitives";

export type ReferenceItem = {
  id: number;
  refereeName: string;
  refereeEmail: string;
  relationship: string | null;
  status: "requested" | "received" | "declined";
  response: string | null;
};

type RequestFn = (formData: FormData) => Promise<{ ok: boolean; error?: string }>;
type ReceiveFn = (referenceId: number, formData: FormData) => Promise<{ ok: boolean; error?: string }>;

const TONE: Record<string, "amber" | "green" | "red"> = { requested: "amber", received: "green", declined: "red" };

export function ReferencesPanel({
  references,
  onRequest,
  onReceive,
}: {
  references: ReferenceItem[];
  onRequest: RequestFn;
  onReceive: ReceiveFn;
}) {
  const [open, setOpen] = useState(false);
  const [logging, setLogging] = useState<number | null>(null);
  const [pending, start] = useTransition();

  const request = (formData: FormData) => {
    start(async () => {
      const r = await onRequest(formData);
      if (!r.ok) { toast.error(r.error || "Failed."); return; }
      toast.success("Reference requested — email sent to the referee.");
      setOpen(false);
    });
  };

  const receive = (referenceId: number, formData: FormData) => {
    start(async () => {
      const r = await onReceive(referenceId, formData);
      if (!r.ok) { toast.error(r.error || "Failed."); return; }
      toast.success("Reference logged.");
      setLogging(null);
    });
  };

  return (
    <div className="space-y-3">
      {references.length === 0 ? (
        <p className="text-sm text-ink-soft">No references requested yet.</p>
      ) : (
        <ul className="space-y-2">
          {references.map((r) => (
            <li key={r.id} className="rounded-lg border border-hairline p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium truncate">{r.refereeName}</span>
                <Badge tone={TONE[r.status]}>{r.status}</Badge>
              </div>
              <div className="text-[11px] text-ink-muted mt-0.5">
                {r.refereeEmail}{r.relationship ? ` · ${r.relationship}` : ""}
              </div>
              {r.response && <p className="text-xs text-ink-soft mt-1.5 whitespace-pre-line">{r.response}</p>}
              {r.status === "requested" && (
                logging === r.id ? (
                  <form action={(fd) => receive(r.id, fd)} className="mt-2 space-y-2">
                    <textarea name="response" rows={3} required placeholder="Paste the referee's reply…" className="input text-sm py-2" />
                    <div className="flex gap-2">
                      <button type="submit" disabled={pending} className="btn-primary text-xs">Save response</button>
                      <button type="button" onClick={() => setLogging(null)} className="btn-ghost text-xs">Cancel</button>
                    </div>
                  </form>
                ) : (
                  <button type="button" onClick={() => setLogging(r.id)} className="text-[11px] text-brand-700 hover:underline mt-1">Log response</button>
                )
              )}
            </li>
          ))}
        </ul>
      )}

      {!open ? (
        <button type="button" onClick={() => setOpen(true)} className="btn-ghost text-xs w-full">+ Request reference</button>
      ) : (
        <form action={request} className="space-y-2 rounded-lg border border-hairline p-3 bg-canvas">
          <input name="refereeName" required placeholder="Referee name" className="input text-sm" />
          <input name="refereeEmail" type="email" required placeholder="Referee email" className="input text-sm" />
          <input name="relationship" placeholder="Relationship (e.g. Former manager)" className="input text-sm" />
          <div className="flex gap-2">
            <button type="submit" disabled={pending} className="btn-primary text-xs flex-1">{pending ? "Sending…" : "Send request"}</button>
            <button type="button" onClick={() => setOpen(false)} className="btn-ghost text-xs">Cancel</button>
          </div>
        </form>
      )}
    </div>
  );
}
