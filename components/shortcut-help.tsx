"use client";

import { useEffect, useState } from "react";
import { X, Keyboard } from "lucide-react";

const SHORTCUTS: Array<{ keys: string[]; label: string; section: string }> = [
  { section: "Navigation", keys: ["⌘", "K"], label: "Open command palette / search" },
  { section: "Navigation", keys: ["N"], label: "Quick-add (new candidate / job / client / vendor)" },
  { section: "Navigation", keys: ["?"], label: "Show this cheat sheet" },
  { section: "Navigation", keys: ["Esc"], label: "Close any open modal / dropdown" },

  { section: "Lists", keys: ["J", "K"], label: "Move focus down / up between rows" },
  { section: "Lists", keys: ["↵"], label: "Open the focused candidate" },
  { section: "Lists", keys: ["X", "␣"], label: "Toggle selection on the focused row" },
  { section: "Lists", keys: ["Hover"], label: "Reveal preview (eye icon) on candidate rows" },

  { section: "Forms", keys: ["⌘", "↵"], label: "Submit a multiline form (comments, notes, tasks)" },
  { section: "Forms", keys: ["↵"], label: "Submit single-line inline edits" },
  { section: "Forms", keys: ["Esc"], label: "Cancel an inline edit / close a modal" },
];

export function ShortcutHelp() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Only intercept "?" when not typing into a field
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      const isTyping = tag === "input" || tag === "textarea" || target?.isContentEditable;
      if (e.key === "?" && !isTyping && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === "Escape" && open) setOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open]);

  if (!open) return null;

  // Group shortcuts by section
  const grouped = SHORTCUTS.reduce<Record<string, typeof SHORTCUTS>>((acc, s) => {
    (acc[s.section] ||= []).push(s);
    return acc;
  }, {});

  return <Dialog onClose={() => setOpen(false)} grouped={grouped} />;
}

export function ShortcutTrigger() {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "?" }))}
      className="hidden md:inline-flex size-10 rounded-full bg-surface border border-hairline items-center justify-center text-ink-soft hover:text-ink text-xs font-semibold"
      aria-label="Keyboard shortcuts"
      title="Keyboard shortcuts (press ?)"
    >
      ?
    </button>
  );
}

function Dialog({ onClose, grouped }: { onClose: () => void; grouped: Record<string, typeof SHORTCUTS> }) {
  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center px-4" role="dialog" aria-modal="true" aria-labelledby="shortcut-title">
      <div className="absolute inset-0 bg-ink_inverted/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md card overflow-hidden">
        <div className="flex items-center justify-between px-5 h-14 border-b border-hairline">
          <div className="flex items-center gap-2">
            <Keyboard size={16} className="text-ink-muted" />
            <h2 id="shortcut-title" className="text-base font-semibold">Keyboard shortcuts</h2>
          </div>
          <button
            onClick={onClose}
            className="size-8 rounded-full text-ink-muted hover:text-ink hover:bg-canvas inline-flex items-center justify-center"
            aria-label="Close"
          >
            <X size={14} />
          </button>
        </div>
        <div className="p-5 space-y-5 max-h-[60vh] overflow-y-auto">
          {Object.entries(grouped).map(([section, items]) => (
            <section key={section}>
              <h3 className="text-[10px] uppercase tracking-wide text-ink-muted mb-2">{section}</h3>
              <ul className="space-y-1.5">
                {items.map((s, i) => (
                  <li key={i} className="flex items-center justify-between text-sm">
                    <span className="text-ink-soft">{s.label}</span>
                    <span className="flex gap-1 shrink-0">
                      {s.keys.map((k, j) => (
                        <kbd
                          key={j}
                          className="px-1.5 h-6 inline-flex items-center rounded-md bg-canvas border border-hairline text-[11px] font-medium text-ink shadow-sm"
                        >
                          {k}
                        </kbd>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
        <div className="px-5 h-9 border-t border-hairline flex items-center justify-between text-[10px] text-ink-muted">
          <span>Press <kbd className="px-1 rounded bg-canvas">?</kbd> to toggle</span>
          <span><kbd className="px-1 rounded bg-canvas">Esc</kbd> to close</span>
        </div>
      </div>
    </div>
  );
}
