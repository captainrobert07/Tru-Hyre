"use client";

import { useTransition } from "react";
import { toast } from "sonner";

type InviteFn = () => Promise<{ ok: boolean; error?: string }>;

export function PortalInviteButton({ onInvite }: { onInvite: InviteFn }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const r = await onInvite();
          if (!r.ok) { toast.error(r.error || "Could not invite."); return; }
          toast.success("Portal invitation emailed to the candidate.");
        })
      }
      className="btn-ghost text-xs w-full"
    >
      {pending ? "Inviting…" : "Invite to self-service portal"}
    </button>
  );
}
