"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useConfirm } from "@/components/confirm";
import { Avatar } from "@/components/avatar";
import { Badge } from "@/components/primitives";
import { bulkVendorAction } from "./bulk-actions";

type Row = {
  id: number;
  name: string;
  country: string | null;
  contactName: string | null;
  candCount: number;
};

export function VendorsBulkTable({ rows }: { rows: Row[] }) {
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

  const handleDelete = async () => {
    const ok = await confirm({
      title: `Delete ${selected.size} vendor${selected.size === 1 ? "" : "s"}?`,
      description: "Removes the vendor; their candidates' vendorAccountId becomes null. Audit log entries survive.",
      destructive: true,
      typeToConfirm: `delete ${selected.size}`,
      confirmLabel: "Delete forever",
    });
    if (!ok) return;
    start(async () => {
      const r = await bulkVendorAction({ ids: [...selected], action: "delete" });
      if (r.ok) {
        toast.success(`Deleted ${r.affected} vendor${r.affected === 1 ? "" : "s"}`);
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
          <button
            type="button"
            disabled={pending}
            onClick={handleDelete}
            className="ml-auto text-xs px-3 h-8 rounded-full text-red-700 hover:bg-red-50 border border-red-100"
          >
            Delete
          </button>
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
          <span className="flex-1">Vendor</span>
          <span className="hidden md:inline">Candidates</span>
        </div>
        {rows.map((v) => {
          const checked = selected.has(v.id);
          return (
            <div key={v.id} className={`px-5 py-3 flex items-center gap-3 transition-colors ${checked ? "bg-brand-50/40" : "hover:bg-canvas"}`}>
              <input
                type="checkbox"
                checked={checked}
                onChange={() => toggleOne(v.id)}
                className="size-4 rounded border-hairline text-brand-500 focus:ring-brand-500"
                aria-label={`Select ${v.name}`}
              />
              <Avatar name={v.name} size="sm" />
              <Link href={`/vendors/${v.id}`} className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{v.name}</div>
                <div className="text-xs text-ink-soft truncate mt-0.5">
                  {[v.country, v.contactName].filter(Boolean).join(" · ") || "—"}
                </div>
              </Link>
              <Badge tone="default">{v.candCount} candidate{v.candCount === 1 ? "" : "s"}</Badge>
            </div>
          );
        })}
      </div>
    </>
  );
}
