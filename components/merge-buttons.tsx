"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useConfirm } from "@/components/confirm";

type MergeFn = (winnerId: number, loserId: number) => Promise<{ ok: boolean; error?: string }>;

export function MergeButtons({
  aId, aName, bId, bName, isAdmin, onMerge,
}: {
  aId: number; aName: string; bId: number; bName: string; isAdmin: boolean; onMerge: MergeFn;
}) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const confirm = useConfirm();

  if (!isAdmin) return <p className="text-[11px] text-ink-muted mt-2">Only admins can merge.</p>;

  const merge = (winnerId: number, winnerName: string, loserId: number, loserName: string) => {
    start(async () => {
      const ok = await confirm({
        title: `Merge into ${winnerName}?`,
        description: `All resumes, submissions, interviews, offers and history from "${loserName}" move to "${winnerName}", then ${loserName} is permanently deleted. This cannot be undone.`,
        destructive: true,
        typeToConfirm: "merge",
        confirmLabel: "Merge & delete",
      });
      if (!ok) return;
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
