"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

type MergeFn = (winnerId: number, loserId: number) => Promise<{ ok: boolean; error?: string }>;

export function MergeButtons({
  aId, aName, bId, bName, isAdmin, onMerge,
}: {
  aId: number; aName: string; bId: number; bName: string; isAdmin: boolean; onMerge: MergeFn;
}) {
  const [pending, start] = useTransition();
  const router = useRouter();

  if (!isAdmin) return <p className="text-[11px] text-ink-muted mt-2">Only admins can merge.</p>;

  const merge = (winnerId: number, winnerName: string, loserId: number, loserName: string) => {
    if (!window.confirm(`Merge "${loserName}" INTO "${winnerName}"? All resumes, submissions, interviews and history move to ${winnerName}, then ${loserName} is deleted. This cannot be undone.`)) return;
    start(async () => {
      const r = await onMerge(winnerId, loserId);
      if (!r.ok) { toast.error(r.error || "Merge failed."); return; }
      toast.success("Candidates merged.");
      router.refresh();
    });
  };

  return (
    <div className="flex flex-wrap gap-2 mt-2">
      <button type="button" disabled={pending} onClick={() => merge(aId, aName, bId, bName)} className="text-[11px] px-2 h-7 rounded-md border border-hairline bg-canvas hover:bg-surface disabled:opacity-50">
        Keep {aName.split(" ")[0]} ← merge other
      </button>
      <button type="button" disabled={pending} onClick={() => merge(bId, bName, aId, aName)} className="text-[11px] px-2 h-7 rounded-md border border-hairline bg-canvas hover:bg-surface disabled:opacity-50">
        Keep {bName.split(" ")[0]} ← merge other
      </button>
    </div>
  );
}
