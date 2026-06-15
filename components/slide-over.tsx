"use client";

import { type ReactNode, useEffect, useRef } from "react";
import { X } from "lucide-react";
import { useFocusTrap } from "@/components/use-focus-trap";

export function SlideOver({
  open,
  onClose,
  title,
  subtitle,
  children,
  width = "lg",
}: {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
  width?: "md" | "lg" | "xl";
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", handler);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  useFocusTrap(open, panelRef);

  if (!open) return null;

  const widthClass =
    width === "md" ? "max-w-md" :
    width === "xl" ? "max-w-2xl" : "max-w-xl";

  return (
    <div className="fixed inset-0 z-[110]" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-ink_inverted/30 backdrop-blur-sm animate-in fade-in" onClick={onClose} />
      <div ref={panelRef} className={`absolute right-0 top-0 bottom-0 ${widthClass} w-full bg-canvas shadow-pop flex flex-col animate-in slide-in-from-right`}>
        <header className="flex items-start justify-between px-5 py-4 border-b border-hairline bg-surface">
          <div className="min-w-0 flex-1">
            {title && <h2 className="text-base font-semibold truncate">{title}</h2>}
            {subtitle && <div className="text-xs text-ink-soft mt-0.5 truncate">{subtitle}</div>}
          </div>
          <button
            onClick={onClose}
            className="size-8 rounded-full text-ink-muted hover:text-ink hover:bg-canvas inline-flex items-center justify-center shrink-0"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  );
}
