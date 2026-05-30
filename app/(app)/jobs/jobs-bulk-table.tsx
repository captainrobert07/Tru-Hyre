"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useConfirm } from "@/components/confirm";
import { JobStatusBadge } from "@/components/primitives";
import { bulkJobAction } from "./bulk-actions";

type Row = {
  id: number;
  title: string;
  status: string;
  location: string | null;
  positions: number;
  clientName: string | null;
};

const STATUS_VALUES = ["open", "hold", "closing", "closed"] as const;

export function JobsBulkTable({ rows }: { rows: Row[] }) {
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

  const setStatus = (status: (typeof STATUS_VALUES)[number]) => {
    start(async () => {
      const r = await bulkJobAction({ ids: [...selected], action: "set_status", status });
      if (r.ok) {
        toast.success(`Set ${r.affected} job${r.affected === 1 ? "" : "s"} → ${status}`);
        clear();
        router.refresh();
      } else {
        toast.error(r.error);
      }
    });
  };

  const handleDelete = async () => {
    const ok = await confirm({
      title: `Delete ${selected.size} job${selected.size === 1 ? "" : "s"}?`,
      description: "Removes the jobs and their submissions. Audit log entries survive.",
      destructive: true,
      typeToConfirm: `delete ${selected.size}`,
      confirmLabel: "Delete forever",
    });
    if (!ok) return;
    start(async () => {
      const r = await bulkJobAction({ ids: [...selected], action: "delete" });
      if (r.ok) {
        toast.success(`Deleted ${r.affected} job${r.affected === 1 ? "" : "s"}`);
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
            <details className="relative">
              <summary className="list-none cursor-pointer text-xs px-3 h-8 rounded-full bg-canvas hover:bg-surface inline-flex items-center gap-1 select-none">
                Set status ▾
              </summary>
              <div className="absolute right-0 top-full mt-2 w-44 card p-1 z-50">
                {STATUS_VALUES.map((s) => (
                  <button
                    key={s}
                    type="button"
                    disabled={pending}
                    onClick={() => setStatus(s)}
                    className="w-full text-left px-3 h-8 rounded-md text-xs hover:bg-canvas capitalize"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </details>
            <button
              type="button"
              disabled={pending}
              onClick={handleDelete}
              className="text-xs px-3 h-8 rounded-full text-red-700 hover:bg-red-50 border border-red-100"
            >
              Delete
            </button>
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
            aria-label="Select all"
          />
          <span className="flex-1">Job</span>
          <span className="hidden md:inline">Status</span>
        </div>

        {rows.map((j) => {
          const checked = selected.has(j.id);
          return (
            <div key={j.id} className={`px-5 py-3 flex items-center gap-3 transition-colors ${checked ? "bg-brand-50/40" : "hover:bg-canvas"}`}>
              <input
                type="checkbox"
                checked={checked}
                onChange={() => toggleOne(j.id)}
                className="size-4 rounded border-hairline text-brand-500 focus:ring-brand-500"
                aria-label={`Select ${j.title}`}
              />
              <Link href={`/jobs/${j.id}`} className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{j.title}</div>
                <div className="text-xs text-ink-soft truncate mt-0.5">
                  {[j.clientName, j.location, `${j.positions} position${j.positions === 1 ? "" : "s"}`].filter(Boolean).join(" · ")}
                </div>
              </Link>
              <JobStatusBadge status={j.status} />
            </div>
          );
        })}
      </div>
    </>
  );
}
