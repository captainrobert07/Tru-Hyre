"use client";

import { useTransition } from "react";
import { toast } from "sonner";

type Stage = "received" | "hr_review" | "screening" | "submitted" | "shortlist" | "interview" | "hold" | "offer" | "joined" | "rejected";

const STAGES: Stage[] = ["received", "hr_review", "screening", "submitted", "shortlist", "interview", "hold", "offer", "joined", "rejected"];

const DESTRUCTIVE: Stage[] = ["rejected"];

export function StageButtons({
  current,
  setStage,
}: {
  current: Stage;
  setStage: (stage: Stage) => Promise<{ ok: true; previousStage: string | null } | { ok: false; error: string }>;
}) {
  const [pending, start] = useTransition();

  const apply = (stage: Stage) => {
    start(async () => {
      const r = await setStage(stage);
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      const prev = r.previousStage;
      if (!prev || prev === stage) {
        toast.success(`Moved to ${stage.replaceAll("_", " ")}`);
        return;
      }
      // Show toast with Undo
      toast.success(`Moved to ${stage.replaceAll("_", " ")}`, {
        action: {
          label: "Undo",
          onClick: () => {
            start(async () => {
              const undo = await setStage(prev as Stage);
              if (undo.ok) toast.success(`Reverted to ${prev.replaceAll("_", " ")}`);
              else toast.error(undo.error);
            });
          },
        },
        duration: 8000,
      });
    });
  };

  const onClick = (stage: Stage) => {
    if (DESTRUCTIVE.includes(stage)) {
      const ok = window.confirm(`Move this candidate to "${stage.replace("_", " ")}"? You can undo within 8 seconds.`);
      if (!ok) return;
    }
    apply(stage);
  };

  return (
    <div className="flex flex-wrap gap-1.5">
      {STAGES.map((s) => (
        <button
          key={s}
          type="button"
          disabled={pending}
          onClick={() => onClick(s)}
          className={`text-xs px-2 h-7 rounded-md border transition-colors disabled:opacity-50 ${
            current === s
              ? "bg-brand-50 text-brand-700 border-brand-100"
              : DESTRUCTIVE.includes(s)
              ? "bg-canvas text-red-700 border-red-100 hover:bg-red-50"
              : "bg-canvas text-ink-soft border-hairline hover:bg-surface"
          }`}
        >
          {s.replaceAll("_", " ")}
        </button>
      ))}
    </div>
  );
}
