"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";

export function CopyableToken({ token, description }: { token: string; description: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(token);
          setCopied(true);
          setTimeout(() => setCopied(false), 1200);
        } catch {
          /* clipboard unavailable */
        }
      }}
      className="w-full text-left flex flex-col gap-0.5 px-2 py-1.5 rounded hover:bg-canvas group"
      aria-label={`Copy ${token}`}
    >
      <span className="font-mono text-[11px] text-brand-700 inline-flex items-center gap-1">
        {token}
        {copied ? <Check size={11} /> : <Copy size={11} className="opacity-0 group-hover:opacity-100 transition-opacity" />}
      </span>
      <span className="text-[10px] text-ink-muted leading-tight">{description}</span>
    </button>
  );
}
