"use client";

import { useFormStatus } from "react-dom";

/**
 * Renders a packet-shaped shimmer while the parent <form> is submitting.
 * Drop it inside the form, after the SubmitButton.
 */
export function PendingShimmer({ label = "Generating PDF…" }: { label?: string }) {
  const { pending } = useFormStatus();
  if (!pending) return null;
  return (
    <div className="mt-3 rounded-lg border border-hairline bg-canvas overflow-hidden">
      <div className="px-3 py-2 border-b border-hairline flex items-center gap-2">
        <span className="size-3 rounded-full border-2 border-brand-500 border-r-transparent animate-spin" />
        <span className="text-xs text-ink-soft">{label}</span>
      </div>
      <div className="p-3 space-y-2">
        <div className="h-3 w-2/3 bg-hairline rounded animate-pulse" />
        <div className="h-3 w-1/2 bg-hairline rounded animate-pulse" />
        <div className="h-3 w-3/4 bg-hairline rounded animate-pulse" />
      </div>
    </div>
  );
}
