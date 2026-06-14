"use client";

import { useActionState } from "react";
import { bookSlotAction, type BookResult } from "./actions";

function fmt(iso: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      weekday: "long", day: "numeric", month: "long", hour: "numeric", minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function SlotPicker({ token, slots }: { token: string; slots: string[] }) {
  const boundAction = bookSlotAction.bind(null, token);
  const [state, action, pending] = useActionState<BookResult | null, FormData>(
    async (_prev: BookResult | null, fd: FormData) => boundAction(fd),
    null,
  );

  if (state?.ok) {
    return (
      <div className="card p-8 text-center">
        <div className="text-3xl mb-2">✅</div>
        <h2 className="text-lg font-semibold">You&apos;re booked</h2>
        <p className="text-sm text-ink-soft mt-2">A calendar invitation is on its way. See you then!</p>
      </div>
    );
  }

  return (
    <form action={action} className="card p-6 space-y-3">
      <p className="text-sm text-ink-soft">Choose the time that works best for you:</p>
      <div className="space-y-2">
        {slots.map((s) => (
          <label key={s} className="flex items-center gap-3 rounded-lg border border-hairline p-3 cursor-pointer hover:bg-canvas has-[:checked]:border-brand-300 has-[:checked]:bg-brand-50">
            <input type="radio" name="slot" value={s} required className="size-4 text-brand-500" />
            <span className="text-sm font-medium">{fmt(s)}</span>
          </label>
        ))}
      </div>
      {state && !state.ok && <div className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{state.error}</div>}
      <button type="submit" disabled={pending} className="btn-primary w-full">{pending ? "Booking…" : "Confirm slot"}</button>
    </form>
  );
}
