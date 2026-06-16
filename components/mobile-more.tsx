"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { MoreHorizontal, X } from "lucide-react";
import { isNavActive } from "@/lib/utils";

type Item = { href: string; label: string; icon: ReactNode };

export function MobileMore({ items, unreadCount = 0 }: { items: Item[]; unreadCount?: number }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname() || "/";

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex flex-col items-center justify-center text-[10px] text-ink-soft gap-0.5 relative"
      >
        <span className="text-ink-muted"><MoreHorizontal size={18} /></span>
        <span>More</span>
        {unreadCount > 0 && (
          <span className="absolute top-2 right-1/2 translate-x-3 size-1.5 rounded-full bg-brand-600" />
        )}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/30" onClick={() => setOpen(false)} />
          <div className="absolute inset-x-0 bottom-0 bg-surface rounded-t-2xl border-t border-hairline pb-6">
            <div className="flex items-center justify-between px-4 h-12 border-b border-hairline">
              <span className="text-sm font-semibold">More</span>
              <button onClick={() => setOpen(false)} className="text-ink-soft hover:text-ink p-1" aria-label="Close">
                <X size={18} />
              </button>
            </div>
            <nav className="px-2 py-2">
              {items.map((it) => {
                const active = isNavActive(pathname, it.href);
                return (
                  <Link
                    key={it.href}
                    href={it.href}
                    onClick={() => setOpen(false)}
                    aria-current={active ? "page" : undefined}
                    className={`flex items-center gap-3 px-3 h-11 rounded-lg text-sm ${
                      active ? "bg-canvas text-ink font-medium" : "text-ink hover:bg-canvas"
                    }`}
                  >
                    <span className={active ? "text-brand-600" : "text-ink-muted"}>{it.icon}</span>
                    {it.label}
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>
      )}
    </>
  );
}
