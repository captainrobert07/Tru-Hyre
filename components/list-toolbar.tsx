"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition, type ChangeEvent } from "react";
import { Search, X } from "lucide-react";
import Link from "next/link";

export function ListToolbar({
  basePath,
  placeholder = "Search…",
  extra,
}: {
  basePath: string;
  placeholder?: string;
  extra?: React.ReactNode;
}) {
  const router = useRouter();
  const sp = useSearchParams();
  const [value, setValue] = useState(sp.get("q") || "");
  const [pending, start] = useTransition();

  const apply = (q: string) => {
    const next = new URLSearchParams(sp.toString());
    if (q) next.set("q", q);
    else next.delete("q");
    next.delete("page"); // reset paging on new search
    start(() => router.replace(`${basePath}${next.toString() ? `?${next}` : ""}`));
  };

  const onChange = (e: ChangeEvent<HTMLInputElement>) => setValue(e.target.value);

  return (
    <div className="card p-1.5 mb-4 flex items-center gap-1.5 flex-wrap">
      <div className="flex-1 min-w-[240px] relative flex items-center">
        <Search size={16} className="absolute left-3 text-ink-muted pointer-events-none" />
        <input
          type="search"
          value={value}
          onChange={onChange}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              apply(value);
            }
          }}
          placeholder={placeholder}
          className="w-full h-9 pl-9 pr-9 rounded-full bg-canvas border border-transparent focus:bg-surface focus:border-hairline text-sm placeholder:text-ink-muted transition-colors"
        />
        {value && (
          <button
            type="button"
            onClick={() => {
              setValue("");
              apply("");
            }}
            className="absolute right-2 size-6 rounded-full text-ink-muted hover:text-ink hover:bg-canvas inline-flex items-center justify-center"
            aria-label="Clear"
          >
            <X size={14} />
          </button>
        )}
      </div>
      {extra}
      <button
        type="button"
        onClick={() => apply(value)}
        disabled={pending}
        className="px-4 h-9 rounded-full bg-ink_inverted text-white text-xs font-medium hover:bg-ink active:scale-[.98] transition disabled:opacity-50"
      >
        {pending ? "Searching…" : "Search"}
      </button>
      <span className="hidden lg:inline-flex items-center gap-1 px-2 text-[11px] text-ink-muted select-none" aria-hidden="true">
        or press
        <kbd className="px-1.5 py-0.5 rounded bg-canvas border border-hairline text-[10px] font-medium">⌘K</kbd>
      </span>
    </div>
  );
}

export function Pager({
  basePath,
  page,
  pageSize,
  total,
  q,
  status,
}: {
  basePath: string;
  page: number;
  pageSize: number;
  total: number;
  q?: string;
  status?: string;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (totalPages <= 1) return null;
  const buildHref = (p: number) => {
    const sp = new URLSearchParams();
    if (q) sp.set("q", q);
    if (status) sp.set("status", status);
    if (p > 1) sp.set("page", String(p));
    const qs = sp.toString();
    return `${basePath}${qs ? `?${qs}` : ""}`;
  };

  const start = (page - 1) * pageSize + 1;
  const end = Math.min(total, page * pageSize);

  return (
    <div className="flex items-center justify-between mt-4 text-sm">
      <div className="text-ink-muted">
        {start}–{end} of {total}
      </div>
      <div className="flex items-center gap-1">
        {page > 1 ? (
          <Link href={buildHref(page - 1)} className="btn-ghost text-xs">← Prev</Link>
        ) : (
          <span className="btn-ghost text-xs opacity-40 pointer-events-none">← Prev</span>
        )}
        <span className="px-3 text-ink-soft tabular-nums">Page {page} / {totalPages}</span>
        {page < totalPages ? (
          <Link href={buildHref(page + 1)} className="btn-ghost text-xs">Next →</Link>
        ) : (
          <span className="btn-ghost text-xs opacity-40 pointer-events-none">Next →</span>
        )}
      </div>
    </div>
  );
}
