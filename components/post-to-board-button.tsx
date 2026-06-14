"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Share2 } from "lucide-react";

export function PostToBoardButton({ onPost }: { onPost: () => Promise<{ ok: boolean; message: string }> }) {
  const [pending, start] = useTransition();
  const click = () => {
    start(async () => {
      const r = await onPost();
      if (r.ok) toast.success(`Job board: ${r.message}`);
      else toast.error(`Job board: ${r.message}`);
    });
  };
  return (
    <button type="button" onClick={click} disabled={pending} className="btn-ghost inline-flex items-center gap-1.5">
      <Share2 size={14} /> {pending ? "Posting…" : "Post to job board"}
    </button>
  );
}
