"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, ClipboardList, X } from "lucide-react";
import { useConfirm } from "@/components/confirm";
import { EmptyState } from "@/components/primitives";

export type KitItem = {
  id: number;
  name: string;
  jobId: number | null;
  jobTitle: string | null;
  focusAreas: string[];
  questions: string[];
};

type JobOption = { id: number; title: string };

type SaveResult = { ok: boolean; error?: string };

export function InterviewKitManager({
  kits,
  jobs,
  onCreate,
  onUpdate,
  onDelete,
}: {
  kits: KitItem[];
  jobs: JobOption[];
  onCreate: (fd: FormData) => Promise<SaveResult>;
  onUpdate: (fd: FormData) => Promise<SaveResult>;
  onDelete: (id: number) => Promise<{ ok: boolean }>;
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const [pending, start] = useTransition();
  // null = closed; 0 = new; >0 = editing that kit id
  const [editing, setEditing] = useState<number | null>(null);

  const blank: KitItem = { id: 0, name: "", jobId: null, jobTitle: null, focusAreas: [], questions: [] };
  const current = editing === null ? null : editing === 0 ? blank : kits.find((k) => k.id === editing) || blank;

  const handleDelete = async (kit: KitItem) => {
    const ok = await confirm({
      title: `Delete "${kit.name}"?`,
      description: "This removes the kit for everyone. Interviews already run aren't affected.",
      destructive: true,
      confirmLabel: "Delete kit",
    });
    if (!ok) return;
    start(async () => {
      const r = await onDelete(kit.id);
      if (r.ok) { toast.success("Kit deleted"); router.refresh(); }
      else toast.error("Couldn't delete kit");
    });
  };

  const handleSubmit = (formData: FormData) => {
    const isNew = editing === 0;
    start(async () => {
      const r = isNew ? await onCreate(formData) : await onUpdate(formData);
      if (r.ok) {
        toast.success(isNew ? "Kit created" : "Kit saved");
        setEditing(null);
        router.refresh();
      } else {
        toast.error(r.error || "Couldn't save kit");
      }
    });
  };

  return (
    <div className="space-y-4">
      {editing === null && (
        <button type="button" onClick={() => setEditing(0)} className="btn-primary inline-flex items-center gap-1.5">
          <Plus size={15} /> New kit
        </button>
      )}

      {current && (
        <form action={handleSubmit} className="card p-5 space-y-4">
          {editing !== 0 && <input type="hidden" name="id" value={current.id} />}
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">{editing === 0 ? "New interview kit" : `Edit "${current.name}"`}</h2>
            <button type="button" onClick={() => setEditing(null)} className="size-7 rounded-full inline-flex items-center justify-center text-ink-muted hover:text-ink" aria-label="Close">
              <X size={15} />
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="kit-name" className="label">Kit name *</label>
              <input id="kit-name" name="name" required maxLength={160} defaultValue={current.name} className="input" placeholder="e.g. Backend systems-design round" />
            </div>
            <div>
              <label htmlFor="kit-job" className="label">Job (optional)</label>
              <select id="kit-job" name="jobId" defaultValue={current.jobId ?? ""} className="input">
                <option value="">— Any / reusable —</option>
                {jobs.map((j) => (
                  <option key={j.id} value={j.id}>{j.title}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label htmlFor="kit-focus" className="label">Focus areas <span className="text-ink-muted font-normal">(one per line)</span></label>
            <textarea id="kit-focus" name="focusAreas" rows={4} defaultValue={current.focusAreas.join("\n")} className="input" placeholder={"System design\nData modelling\nTrade-off reasoning"} />
          </div>
          <div>
            <label htmlFor="kit-questions" className="label">Questions <span className="text-ink-muted font-normal">(one per line)</span></label>
            <textarea id="kit-questions" name="questions" rows={6} defaultValue={current.questions.join("\n")} className="input" placeholder={"Walk me through designing a URL shortener.\nHow would you scale it to 10k req/s?"} />
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={pending} className="btn-primary">{pending ? "Saving…" : "Save kit"}</button>
            <button type="button" onClick={() => setEditing(null)} className="btn-ghost">Cancel</button>
          </div>
        </form>
      )}

      {kits.length === 0 && editing === null ? (
        <EmptyState
          icon={<ClipboardList size={28} />}
          title="No interview kits yet"
          description="Create one to give interviewers a consistent set of focus areas and questions."
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {kits.map((kit) => (
            <section key={kit.id} className="card p-4">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold truncate">{kit.name}</h3>
                  <p className="text-xs text-ink-muted">{kit.jobTitle ? kit.jobTitle : "Reusable across jobs"}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button type="button" onClick={() => setEditing(kit.id)} disabled={pending} className="size-7 rounded-full inline-flex items-center justify-center text-ink-muted hover:text-ink hover:bg-canvas" aria-label={`Edit ${kit.name}`}>
                    <Pencil size={13} />
                  </button>
                  <button type="button" onClick={() => handleDelete(kit)} disabled={pending} className="size-7 rounded-full inline-flex items-center justify-center text-ink-muted hover:text-red-600 hover:bg-canvas" aria-label={`Delete ${kit.name}`}>
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
              {kit.focusAreas.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-2">
                  {kit.focusAreas.map((f, i) => (
                    <span key={i} className="text-[11px] px-2 py-0.5 rounded-full bg-canvas text-ink-soft">{f}</span>
                  ))}
                </div>
              )}
              {kit.questions.length > 0 ? (
                <ul className="text-xs text-ink-soft list-disc pl-4 space-y-0.5">
                  {kit.questions.slice(0, 5).map((q, i) => <li key={i} className="truncate">{q}</li>)}
                  {kit.questions.length > 5 && <li className="text-ink-muted list-none pl-0">+{kit.questions.length - 5} more</li>}
                </ul>
              ) : (
                <p className="text-xs text-ink-muted">No questions yet.</p>
              )}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
