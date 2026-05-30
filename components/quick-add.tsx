"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Plus, X, Users, Briefcase, Building2, Truck, Send, ListTodo } from "lucide-react";

const ITEMS: Array<{
  href: string;
  label: string;
  hint: string;
  icon: React.ReactNode;
  shortcut?: string;
}> = [
  { href: "/candidates/upload", label: "New candidate", hint: "Upload PDF or paste resume", icon: <Users size={16} /> },
  { href: "/jobs/new", label: "New job", hint: "Open a new requisition", icon: <Briefcase size={16} /> },
  { href: "/clients/new", label: "New client", hint: "Add a hiring company", icon: <Building2 size={16} /> },
  { href: "/vendors/new", label: "New vendor", hint: "Add a sourcing partner", icon: <Truck size={16} /> },
  { href: "/settings/invitations/new", label: "Invite user", hint: "Send an account invitation", icon: <Send size={16} /> },
  { href: "/dashboard", label: "Add task", hint: "Reminder on your dashboard", icon: <ListTodo size={16} /> },
];

export function QuickAdd() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      const isTyping = tag === "input" || tag === "textarea" || target?.isContentEditable;
      if (isTyping) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key === "n" || e.key === "N") {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === "Escape" && open) setOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="hidden md:inline-flex size-10 rounded-full bg-brand-500 text-white items-center justify-center hover:bg-brand-600 active:scale-[.98] transition shadow-card"
        aria-label="Quick add (N)"
        title="Create new… (N)"
      >
        <Plus size={18} />
      </button>

      {open && (
        <div className="fixed inset-0 z-[110] flex items-start justify-center pt-[18vh] px-4" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-ink_inverted/40 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="relative w-full max-w-md card overflow-hidden">
            <div className="flex items-center justify-between px-5 h-14 border-b border-hairline">
              <div className="flex items-center gap-2">
                <Plus size={16} className="text-ink-muted" />
                <h2 className="text-base font-semibold">Create new…</h2>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="size-8 rounded-full text-ink-muted hover:text-ink hover:bg-canvas inline-flex items-center justify-center"
                aria-label="Close"
              >
                <X size={14} />
              </button>
            </div>
            <div className="p-2">
              {ITEMS.map((it) => (
                <Link
                  key={it.href}
                  href={it.href}
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3 px-3 h-12 rounded-lg hover:bg-canvas group"
                >
                  <span className="size-9 rounded-xl2 bg-brand-50 text-brand-700 inline-flex items-center justify-center shrink-0">
                    {it.icon}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-medium">{it.label}</span>
                    <span className="block text-[11px] text-ink-muted truncate">{it.hint}</span>
                  </span>
                </Link>
              ))}
            </div>
            <div className="px-5 h-9 border-t border-hairline flex items-center justify-between text-[10px] text-ink-muted">
              <span>Press <kbd className="px-1 rounded bg-canvas">N</kbd> to toggle</span>
              <span><kbd className="px-1 rounded bg-canvas">Esc</kbd> to close</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
