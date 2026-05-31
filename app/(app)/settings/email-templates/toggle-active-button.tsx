"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { toggleActiveAction } from "./actions";

export function ToggleActiveButton({ slug, isActive }: { slug: string; isActive: boolean }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      onClick={() =>
        start(async () => {
          const r = await toggleActiveAction(slug, !isActive);
          if (!r.ok) toast.error(r.error);
          else toast.success(isActive ? "Disabled" : "Enabled");
        })
      }
      disabled={pending}
      className={`inline-flex items-center text-[11px] h-7 px-2.5 rounded-full transition-colors disabled:opacity-50 ${
        isActive
          ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-200"
          : "bg-canvas text-ink-soft hover:text-ink"
      }`}
      aria-label={isActive ? "Disable" : "Enable"}
    >
      {isActive ? "Active" : "Off"}
    </button>
  );
}
