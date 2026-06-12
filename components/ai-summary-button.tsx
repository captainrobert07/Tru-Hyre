"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

type GenFn = () => Promise<{ ok: boolean; summary?: string; error?: string }>;

export function AiSummaryButton({ onGenerate }: { onGenerate: GenFn }) {
  const [pending, start] = useTransition();
  const router = useRouter();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const r = await onGenerate();
          if (!r.ok) {
            toast.error(r.error || "Could not generate summary.");
            return;
          }
          toast.success("Summary generated.");
          router.refresh();
        })
      }
      className="text-[11px] text-brand-700 hover:underline disabled:opacity-50"
    >
      {pending ? "Generating…" : "✨ AI summary"}
    </button>
  );
}
