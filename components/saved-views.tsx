"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { Bookmark, BookmarkPlus, X, Users, Share2 } from "lucide-react";
import { useConfirm } from "@/components/confirm";

export type SavedView = {
  id: number;
  name: string;
  query: Record<string, string>;
  pinned: boolean;
  shared?: boolean;
  /** True when the current user owns this view (can delete/share). */
  own?: boolean;
  /** Display name of the owner, shown on views shared by someone else. */
  ownerName?: string | null;
};

export function SavedViews({
  scope,
  basePath,
  views,
  onCreate,
  onDelete,
  onToggleShare,
}: {
  scope: "candidates" | "jobs" | "clients" | "vendors" | "submissions";
  basePath: string;
  views: SavedView[];
  onCreate: (input: { scope: typeof scope; name: string; query: Record<string, string> }) => Promise<{ ok: true; id: number } | { ok: false; error: string }>;
  onDelete: (id: number) => Promise<void>;
  /** Optional share/unshare handler. When omitted, the share toggle is hidden. */
  onToggleShare?: (id: number) => Promise<{ ok: boolean }>;
}) {
  const sp = useSearchParams();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const confirm = useConfirm();

  const currentQuery: Record<string, string> = {};
  sp.forEach((v, k) => { if (v) currentQuery[k] = v; });
  const hasFilters = Object.keys(currentQuery).length > 0;

  const buildHref = (q: Record<string, string>) => {
    const params = new URLSearchParams(q);
    const s = params.toString();
    return `${basePath}${s ? `?${s}` : ""}`;
  };

  const isActive = (q: Record<string, string>) => {
    const cur = JSON.stringify(currentQuery);
    return cur === JSON.stringify(q);
  };

  const handleCreate = async () => {
    if (!name.trim()) return;
    start(async () => {
      const r = await onCreate({ scope, name: name.trim(), query: currentQuery });
      if (r.ok) {
        toast.success(`Saved "${name.trim()}"`);
        setName("");
        setCreating(false);
        router.refresh();
      } else {
        toast.error(r.error);
      }
    });
  };

  const handleDelete = async (id: number, viewName: string) => {
    const ok = await confirm({
      title: `Delete saved view "${viewName}"?`,
      description: "This only removes the saved filter, not any candidates.",
      destructive: true,
      confirmLabel: "Delete view",
    });
    if (!ok) return;
    start(async () => {
      await onDelete(id);
      toast.success("View deleted");
      router.refresh();
    });
  };

  const handleToggleShare = async (id: number, name: string, nowShared: boolean) => {
    if (!onToggleShare) return;
    start(async () => {
      const r = await onToggleShare(id);
      if (r.ok) {
        toast.success(nowShared ? `"${name}" is now private` : `Shared "${name}" with all staff`);
        router.refresh();
      } else {
        toast.error("Couldn't update sharing");
      }
    });
  };

  return (
    <div className="flex items-center gap-1.5 flex-wrap mb-3">
      <Link
        href={basePath}
        className={`text-xs px-3 h-8 rounded-full inline-flex items-center transition-colors ${
          !hasFilters ? "bg-ink_inverted text-white" : "bg-canvas text-ink-soft hover:text-ink"
        }`}
      >
        All
      </Link>
      {views.map((v) => {
        const own = v.own ?? true;
        return (
        <span
          key={v.id}
          className={`group inline-flex items-center rounded-full transition-colors ${
            isActive(v.query) ? "bg-ink_inverted text-white" : "bg-canvas text-ink-soft hover:text-ink"
          }`}
        >
          <Link
            href={buildHref(v.query)}
            className="text-xs pl-3 h-8 inline-flex items-center gap-1.5 pr-1"
            title={own ? undefined : `Shared by ${v.ownerName || "a colleague"}`}
          >
            {own ? (
              <Bookmark size={11} className="opacity-70" />
            ) : (
              <Users size={11} className="opacity-70" />
            )}
            {v.name}
            {!own && v.ownerName && (
              <span className="opacity-60 hidden sm:inline">· {v.ownerName.split(" ")[0]}</span>
            )}
          </Link>
          {own && onToggleShare && (
            <button
              type="button"
              onClick={() => handleToggleShare(v.id, v.name, !!v.shared)}
              disabled={pending}
              className={`size-5 rounded-full inline-flex items-center justify-center hover:bg-white/15 ${
                v.shared ? "text-brand-500 opacity-100" : "opacity-0 group-hover:opacity-100"
              } ${isActive(v.query) && v.shared ? "text-white" : ""}`}
              aria-label={v.shared ? `Stop sharing ${v.name}` : `Share ${v.name} with all staff`}
              title={v.shared ? "Shared with all staff — click to make private" : "Share with all staff"}
            >
              <Share2 size={10} />
            </button>
          )}
          {own && (
            <button
              type="button"
              onClick={() => handleDelete(v.id, v.name)}
              disabled={pending}
              className="size-5 rounded-full mr-1.5 inline-flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-white/15"
              aria-label={`Delete view ${v.name}`}
            >
              <X size={10} />
            </button>
          )}
          {!own && <span className="pr-2.5" />}
        </span>
        );
      })}

      {hasFilters && !creating && (
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="text-xs px-3 h-8 rounded-full bg-brand-50 text-brand-700 hover:bg-brand-100 inline-flex items-center gap-1"
        >
          <BookmarkPlus size={12} /> Save view
        </button>
      )}

      {creating && (
        <div className="inline-flex items-center gap-1 bg-surface border border-hairline rounded-full pl-3 pr-1 h-8">
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="View name"
            maxLength={80}
            className="bg-transparent text-xs outline-none w-32"
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCreate();
              if (e.key === "Escape") { setCreating(false); setName(""); }
            }}
          />
          <button
            type="button"
            onClick={handleCreate}
            disabled={pending || !name.trim()}
            className="text-xs px-2 h-6 rounded-full bg-brand-500 text-white disabled:opacity-50"
          >
            Save
          </button>
          <button
            type="button"
            onClick={() => { setCreating(false); setName(""); }}
            className="size-6 rounded-full text-ink-muted hover:text-ink inline-flex items-center justify-center"
            aria-label="Cancel"
          >
            <X size={11} />
          </button>
        </div>
      )}
    </div>
  );
}
