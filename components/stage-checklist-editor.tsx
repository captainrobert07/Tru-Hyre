"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, X, ListChecks } from "lucide-react";
import { useConfirm } from "@/components/confirm";

export type ChecklistItem = { id: number; stage: string; label: string };

const STAGES = [
  "received",
  "hr_review",
  "screening",
  "submitted",
  "shortlist",
  "interview",
  "offer",
  "joined",
] as const;

const stageLabel = (s: string) => s.replaceAll("_", " ");

export function StageChecklistEditor({
  items,
  onAdd,
  onDelete,
}: {
  items: ChecklistItem[];
  onAdd: (fd: FormData) => Promise<{ ok: boolean; error?: string }>;
  onDelete: (itemId: number) => Promise<{ ok: boolean }>;
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const [pending, start] = useTransition();
  const [stage, setStage] = useState<string>(STAGES[1]); // default hr_review
  const [label, setLabel] = useState("");

  const byStage = new Map<string, ChecklistItem[]>();
  for (const it of items) {
    if (!byStage.has(it.stage)) byStage.set(it.stage, []);
    byStage.get(it.stage)!.push(it);
  }

  const handleAdd = () => {
    if (!label.trim()) return;
    const fd = new FormData();
    fd.set("stage", stage);
    fd.set("label", label.trim());
    start(async () => {
      const r = await onAdd(fd);
      if (r.ok) {
        toast.success("Checklist item added");
        setLabel("");
        router.refresh();
      } else {
        toast.error(r.error || "Couldn't add item");
      }
    });
  };

  const handleDelete = async (item: ChecklistItem) => {
    const ok = await confirm({
      title: "Remove checklist item?",
      description: item.label,
      destructive: true,
      confirmLabel: "Remove",
    });
    if (!ok) return;
    start(async () => {
      const r = await onDelete(item.id);
      if (r.ok) {
        toast.success("Removed");
        router.refresh();
      } else {
        toast.error("Couldn't remove item");
      }
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2 text-xs text-ink-muted">
        <ListChecks size={14} className="mt-0.5 shrink-0" />
        <span>Advisory checklists per pipeline stage. They guide recruiters but don&apos;t block stage changes.</span>
      </div>

      {/* Existing items grouped by stage */}
      {items.length === 0 ? (
        <div className="text-sm text-ink-soft">No checklist items yet.</div>
      ) : (
        <div className="space-y-3">
          {STAGES.filter((s) => byStage.has(s)).map((s) => (
            <div key={s}>
              <div className="text-[11px] uppercase tracking-wide text-ink-muted mb-1.5 capitalize">{stageLabel(s)}</div>
              <ul className="space-y-1">
                {byStage.get(s)!.map((it) => (
                  <li
                    key={it.id}
                    className="group flex items-center justify-between gap-2 text-sm bg-canvas rounded-lg px-3 py-1.5"
                  >
                    <span className="truncate">{it.label}</span>
                    <button
                      type="button"
                      onClick={() => handleDelete(it)}
                      disabled={pending}
                      className="size-5 rounded-full inline-flex items-center justify-center text-ink-muted hover:text-red-600 opacity-0 group-hover:opacity-100"
                      aria-label={`Remove ${it.label}`}
                    >
                      <X size={12} />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {/* Add row */}
      <div className="flex flex-col sm:flex-row gap-2 pt-3 border-t border-hairline">
        <select
          value={stage}
          onChange={(e) => setStage(e.target.value)}
          className="input sm:w-40 capitalize"
          aria-label="Stage"
        >
          {STAGES.map((s) => (
            <option key={s} value={s} className="capitalize">{stageLabel(s)}</option>
          ))}
        </select>
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="e.g. Confirm notice period"
          maxLength={200}
          className="input flex-1"
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAdd(); } }}
        />
        <button
          type="button"
          onClick={handleAdd}
          disabled={pending || !label.trim()}
          className="btn-ghost shrink-0 inline-flex items-center gap-1"
        >
          <Plus size={14} /> Add
        </button>
      </div>
    </div>
  );
}
