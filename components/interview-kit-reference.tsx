"use client";

import { useState } from "react";
import Link from "next/link";
import { ClipboardList, ChevronDown } from "lucide-react";

export type KitRef = {
  id: number;
  name: string;
  focusAreas: string[];
  questions: string[];
};

/**
 * Read-only reference of interview kits relevant to this candidate, shown in
 * the Interviews section so an interviewer can pull up focus areas + questions
 * while running a round. Editing happens on /interview-kits.
 */
export function InterviewKitReference({ kits }: { kits: KitRef[] }) {
  const [openId, setOpenId] = useState<number | null>(kits.length === 1 ? kits[0].id : null);
  if (kits.length === 0) return null;

  return (
    <div className="mt-3 pt-3 border-t border-hairline">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-ink-soft inline-flex items-center gap-1.5">
          <ClipboardList size={13} /> Interview kits
        </span>
        <Link href="/interview-kits" className="text-[11px] text-brand-700 hover:underline">Manage</Link>
      </div>
      <ul className="space-y-1.5">
        {kits.map((kit) => {
          const open = openId === kit.id;
          return (
            <li key={kit.id} className="bg-canvas rounded-lg">
              <button
                type="button"
                onClick={() => setOpenId(open ? null : kit.id)}
                className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left"
                aria-expanded={open}
              >
                <span className="text-sm truncate">{kit.name}</span>
                <ChevronDown size={14} className={`shrink-0 text-ink-muted transition-transform ${open ? "rotate-180" : ""}`} />
              </button>
              {open && (
                <div className="px-3 pb-3 space-y-2">
                  {kit.focusAreas.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {kit.focusAreas.map((f, i) => (
                        <span key={i} className="text-[11px] px-2 py-0.5 rounded-full bg-surface border border-hairline text-ink-soft">{f}</span>
                      ))}
                    </div>
                  )}
                  {kit.questions.length > 0 ? (
                    <ol className="text-xs text-ink-soft list-decimal pl-4 space-y-1">
                      {kit.questions.map((q, i) => <li key={i}>{q}</li>)}
                    </ol>
                  ) : (
                    <p className="text-xs text-ink-muted">No questions in this kit.</p>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
