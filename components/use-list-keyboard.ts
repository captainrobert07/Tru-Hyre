"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * J/K to navigate, Enter to open, X to toggle select.
 * Disables itself while user is typing in inputs/textareas.
 *
 * Returns { focusedId, setFocusedId } so the calling component can
 * highlight the focused row.
 */
export function useListKeyboard<T extends { id: number; href: string }>({
  rows,
  onToggleSelect,
}: {
  rows: T[];
  onToggleSelect?: (id: number) => void;
}) {
  const router = useRouter();
  const [focusedId, setFocusedId] = useState<number | null>(null);

  useEffect(() => {
    if (rows.length > 0 && focusedId === null) {
      setFocusedId(rows[0].id);
    }
  }, [rows, focusedId]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      const isTyping = tag === "input" || tag === "textarea" || target?.isContentEditable;
      if (isTyping) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (rows.length === 0) return;
      const idx = focusedId === null ? -1 : rows.findIndex((r) => r.id === focusedId);

      if (e.key === "j" || e.key === "ArrowDown") {
        e.preventDefault();
        const nextIdx = idx < 0 ? 0 : Math.min(rows.length - 1, idx + 1);
        setFocusedId(rows[nextIdx].id);
        // Scroll the row into view
        document.getElementById(`row-${rows[nextIdx].id}`)?.scrollIntoView({ block: "nearest" });
      } else if (e.key === "k" || e.key === "ArrowUp") {
        e.preventDefault();
        const nextIdx = idx <= 0 ? 0 : idx - 1;
        setFocusedId(rows[nextIdx].id);
        document.getElementById(`row-${rows[nextIdx].id}`)?.scrollIntoView({ block: "nearest" });
      } else if (e.key === "Enter" && focusedId !== null) {
        e.preventDefault();
        const row = rows.find((r) => r.id === focusedId);
        if (row) router.push(row.href);
      } else if ((e.key === "x" || e.key === " ") && focusedId !== null && onToggleSelect) {
        e.preventDefault();
        onToggleSelect(focusedId);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [rows, focusedId, router, onToggleSelect]);

  return { focusedId, setFocusedId };
}
