"use client";

import { useTransition } from "react";

type Stage = "received" | "hr_review" | "screening" | "submitted" | "shortlist" | "interview" | "hold" | "offer" | "joined" | "rejected";

const STAGES: Stage[] = ["received", "hr_review", "screening", "submitted", "shortlist", "interview", "hold", "offer", "joined", "rejected"];

const DESTRUCTIVE: Stage[] = ["rejected"];

export function StageButtons({
  current,
  setStage,
}: {
  current: Stage;
  setStage: (stage: Stage) => Promise<void>;
}) {
  const [pending, start] = useTransition();

  const onClick = (stage: Stage) => {
    if (DESTRUCTIVE.includes(stage)) {
      const ok = window.confirm(`Move this candidate to "${stage.replace("_", " ")}"? This is hard to undo.`);
      if (!ok) return;
    }
    start(() => setStage(stage));
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
