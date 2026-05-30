"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

const STORAGE_KEY = "th_recent_v1";
const MAX = 8;

export type RecentEntry = {
  href: string;
  label: string;
  kind: "candidate" | "job" | "client" | "vendor";
  ts: number;
};

export function getRecent(): RecentEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((p): p is RecentEntry => p && typeof p.href === "string" && typeof p.label === "string");
  } catch {
    return [];
  }
}

function pushRecent(entry: RecentEntry) {
  if (typeof window === "undefined") return;
  try {
    const existing = getRecent().filter((e) => e.href !== entry.href);
    const next = [{ ...entry, ts: Date.now() }, ...existing].slice(0, MAX);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // localStorage might be unavailable (private mode, quotas)
  }
}

/**
 * Mount this on a candidate / job / client / vendor detail page —
 * it records the visit in localStorage so Cmd+K can surface it later.
 */
export function RecentTracker({ kind, label }: { kind: RecentEntry["kind"]; label: string }) {
  const path = usePathname();
  useEffect(() => {
    pushRecent({ href: path, label, kind, ts: Date.now() });
  }, [path, label, kind]);
  return null;
}
