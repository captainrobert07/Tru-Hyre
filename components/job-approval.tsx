"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

type ApproveFn = (approve: boolean) => Promise<{ ok: boolean }>;

export function JobApproval({ status, isAdmin, onDecide }: { status: string; isAdmin: boolean; onDecide: ApproveFn }) {
  const [pending, start] = useTransition();
  const router = useRouter();

  if (status === "approved") return null;

  const tone =
    status === "pending" ? "bg-amber-50 border-amber-200 text-amber-800"
    : status === "rejected" ? "bg-red-50 border-red-200 text-red-800"
    : "bg-canvas border-hairline text-ink-soft";

  const decide = (approve: boolean) =>
    start(async () => {
      const r = await onDecide(approve);
      if (!r.ok) { toast.error("Failed."); return; }
      toast.success(approve ? "Approved" : "Rejected");
      router.refresh();
    });

  return (
    <div className={`rounded-xl2 border p-4 mb-6 ${tone}`}>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="text-sm font-medium">
          {status === "pending" ? "This requisition is pending approval." : status === "rejected" ? "This requisition was rejected." : `Requisition: ${status}`}
        </div>
        {isAdmin && status !== "approved" && (
          <div className="flex gap-2">
            <button type="button" disabled={pending} onClick={() => decide(true)} className="btn-primary text-xs">Approve</button>
            {status === "pending" && (
              <button type="button" disabled={pending} onClick={() => decide(false)} className="btn-ghost text-xs">Reject</button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
