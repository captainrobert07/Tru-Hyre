"use client";

import Link from "next/link";
import { type ReactNode, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useConfirm } from "@/components/confirm";

export type BulkRow = { id: number; primary: ReactNode; secondary?: ReactNode; trailing?: ReactNode; href: string };

export type BulkActionDef =
  | { kind: "menu"; label: string; values: Array<{ value: string; label: string; destructive?: boolean }>; run: (ids: number[], value: string) => Promise<{ ok: true; affected: number } | { ok: false; error: string }> }
  | { kind: "destructive"; label: string; confirmTitle: (n: number) => string; confirmDescription?: string; run: (ids: number[]) => Promise<{ ok: true; affected: number } | { ok: false; error: string }> };

export function BulkList({
  rows,
  actions,
  selectAllLabel = "Select all",
}: {
  rows: BulkRow[];
  actions: BulkActionDef[];
  selectAllLabel?: string;
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [pending, start] = useTransition();

  const allChecked = rows.length > 0 && selected.size === rows.length;
  const someChecked = selected.size > 0 && selected.size < rows.length;

  const toggleAll = () => setSelected(allChecked ? new Set() : new Set(rows.map((r) => r.id)));
  const toggleOne = (id: number) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };
  const clear = () => setSelected(new Set());

  const handleMenu = (a: BulkActionDef & { kind: "menu" }, value: string) => {
    start(async () => {
      const r = await a.run([...selected], value);
      if (r.ok) {
        toast.success(`Updated ${r.affected} item${r.affected === 1 ? "" : "s"}`);
        clear();
        router.refresh();
      } else {
        toast.error(r.error);
      }
    });
  };

  const handleDestructive = async (a: BulkActionDef & { kind: "destructive" }) => {
    const ok = await confirm({
      title: a.confirmTitle(selected.size),
      description: a.confirmDescription,
      destructive: true,
      typeToConfirm: `delete ${selected.size}`,
      confirmLabel: "Delete forever",
    });
    if (!ok) return;
    start(async () => {
      const r = await a.run([...selected]);
      if (r.ok) {
        toast.success(`Deleted ${r.affected} item${r.affected === 1 ? "" : "s"}`);
        clear();
        router.refresh();
      } else {
        toast.error(r.error);
      }
    });
  };

  return (
    <>
      {selected.size > 0 && (
        <div className="sticky top-[68px] z-30 mb-3 card flex items-center gap-2 px-3 py-2 flex-wrap shadow-pop">
          <span className="text-sm font-medium px-2">{selected.size} selected</span>
          <button onClick={clear} className="text-xs text-ink-soft hover:text-ink px-2">Clear</button>

          <div className="ml-auto flex flex-wrap gap-1.5">
            {actions.map((a, i) =>
              a.kind === "menu" ? (
                <details key={i} className="relative">
                  <summary className="list-none cursor-pointer text-xs px-3 h-8 rounded-full bg-canvas hover:bg-surface inline-flex items-center gap-1 select-none">
                    {a.label} ▾
                  </summary>
                  <div className="absolute right-0 top-full mt-2 w-48 card p-1 z-50">
                    {a.values.map((v) => (
                      <button
                        key={v.value}
                        type="button"
                        disabled={pending}
                        onClick={() => handleMenu(a, v.value)}
                        className={`w-full text-left px-3 h-8 rounded-md text-xs hover:bg-canvas capitalize ${
                          v.destructive ? "text-red-700" : ""
                        }`}
                      >
                        {v.label}
                      </button>
                    ))}
                  </div>
                </details>
              ) : (
                <button
                  key={i}
                  type="button"
                  disabled={pending}
                  onClick={() => handleDestructive(a)}
                  className="text-xs px-3 h-8 rounded-full text-red-700 hover:bg-red-50 border border-red-100"
                >
                  {a.label}
                </button>
              ),
            )}
          </div>
        </div>
      )}

      <div className="card overflow-hidden divide-y divide-hairline">
        <div className="px-5 py-3 flex items-center gap-3 bg-canvas/50 text-[11px] uppercase tracking-wide text-ink-muted">
          <input
            type="checkbox"
            checked={allChecked}
            ref={(el) => { if (el) el.indeterminate = someChecked; }}
            onChange={toggleAll}
            className="size-4 rounded border-hairline text-brand-500 focus:ring-brand-500"
            aria-label={selectAllLabel}
          />
          <span className="flex-1">Item</span>
          <span className="hidden md:inline">Status</span>
        </div>
        {rows.map((r) => {
          const checked = selected.has(r.id);
          return (
            <div
              key={r.id}
              className={`px-5 py-3 flex items-center gap-3 transition-colors ${checked ? "bg-brand-50/40" : "hover:bg-canvas"}`}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => toggleOne(r.id)}
                className="size-4 rounded border-hairline text-brand-500 focus:ring-brand-500"
                aria-label="Select"
              />
              <Link href={r.href} className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{r.primary}</div>
                {r.secondary && <div className="text-xs text-ink-soft truncate mt-0.5">{r.secondary}</div>}
              </Link>
              {r.trailing && <span className="shrink-0">{r.trailing}</span>}
            </div>
          );
        })}
      </div>
    </>
  );
}
