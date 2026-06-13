"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/primitives";

export type OfferItem = {
  id: number;
  title: string | null;
  ctc: string | null;
  currency: string;
  joiningDate: string | null;
  expiresOn: string | null;
  status: "draft" | "extended" | "accepted" | "declined" | "withdrawn";
  notes: string | null;
};

type CreateFn = (formData: FormData) => Promise<{ ok: boolean; error?: string }>;
type StatusFn = (offerId: number, status: string) => Promise<{ ok: boolean; error?: string }>;

const STATUS_TONE: Record<string, "green" | "amber" | "red" | "blue" | "default"> = {
  draft: "default",
  extended: "blue",
  accepted: "green",
  declined: "red",
  withdrawn: "default",
};
const NEXT_STATUSES: Record<string, { value: string; label: string }[]> = {
  draft: [{ value: "extended", label: "Mark extended" }, { value: "withdrawn", label: "Withdraw" }],
  extended: [{ value: "accepted", label: "Accepted" }, { value: "declined", label: "Declined" }, { value: "withdrawn", label: "Withdraw" }],
  accepted: [],
  declined: [],
  withdrawn: [],
};

function fmtMoney(v: string | null, cur: string): string {
  if (!v) return "—";
  const n = Number(v);
  if (Number.isNaN(n)) return v;
  if (n >= 10_000_000) return `${cur} ${(n / 10_000_000).toFixed(1)}cr`;
  if (n >= 100_000) return `${cur} ${(n / 100_000).toFixed(1)}L`;
  return `${cur} ${n.toLocaleString()}`;
}

export function OffersPanel({
  offers,
  onCreate,
  onSetStatus,
}: {
  offers: OfferItem[];
  onCreate: CreateFn;
  onSetStatus: StatusFn;
}) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  const create = (formData: FormData) => {
    start(async () => {
      const r = await onCreate(formData);
      if (!r.ok) { toast.error(r.error || "Could not create offer."); return; }
      toast.success("Offer created.");
      setOpen(false);
    });
  };

  const setStatus = (offerId: number, status: string) => {
    start(async () => {
      const r = await onSetStatus(offerId, status);
      if (!r.ok) { toast.error(r.error || "Failed."); return; }
      toast.success(`Offer ${status}.`);
    });
  };

  return (
    <div className="space-y-3">
      {offers.length === 0 ? (
        <p className="text-sm text-ink-soft">No offers yet.</p>
      ) : (
        <ul className="space-y-2">
          {offers.map((o) => (
            <li key={o.id} className="rounded-lg border border-hairline p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium truncate">{o.title || "Offer"}</span>
                <Badge tone={STATUS_TONE[o.status]}>{o.status}</Badge>
              </div>
              <div className="text-xs text-ink-soft mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
                <span>{fmtMoney(o.ctc, o.currency)}</span>
                {o.joiningDate && <span>joins {o.joiningDate}</span>}
                {o.expiresOn && <span>expires {o.expiresOn}</span>}
              </div>
              {o.notes && <p className="text-xs text-ink-soft mt-1 whitespace-pre-line">{o.notes}</p>}
              <a
                href={`/api/offers/${o.id}/letter`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] text-brand-700 hover:underline mt-1 inline-block"
              >
                Download offer letter (PDF)
              </a>
              {NEXT_STATUSES[o.status]?.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {NEXT_STATUSES[o.status].map((s) => (
                    <button
                      key={s.value}
                      type="button"
                      disabled={pending}
                      onClick={() => setStatus(o.id, s.value)}
                      className="text-[11px] px-2 h-6 rounded-md border border-hairline bg-canvas text-ink-soft hover:bg-surface disabled:opacity-50"
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {!open ? (
        <button type="button" onClick={() => setOpen(true)} className="btn-ghost text-xs w-full">+ New offer</button>
      ) : (
        <form action={create} className="space-y-2 rounded-lg border border-hairline p-3 bg-canvas">
          <input name="title" placeholder="Role / title" className="input text-sm" />
          <div className="grid grid-cols-2 gap-2">
            <input name="ctc" placeholder="CTC (number)" className="input text-sm" />
            <select name="currency" defaultValue="INR" className="input text-sm">
              <option value="INR">INR</option>
              <option value="EUR">EUR</option>
              <option value="USD">USD</option>
              <option value="GBP">GBP</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <label className="text-[11px] text-ink-muted">Joining<input name="joiningDate" type="date" className="input text-sm" /></label>
            <label className="text-[11px] text-ink-muted">Expires<input name="expiresOn" type="date" className="input text-sm" /></label>
          </div>
          <textarea name="notes" rows={2} placeholder="Notes (optional)" className="input text-sm py-2" />
          <div className="flex gap-2">
            <button type="submit" disabled={pending} className="btn-primary text-xs flex-1">{pending ? "Saving…" : "Create offer"}</button>
            <button type="button" onClick={() => setOpen(false)} className="btn-ghost text-xs">Cancel</button>
          </div>
        </form>
      )}
    </div>
  );
}
