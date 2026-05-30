"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Check, Clock, Plus, X } from "lucide-react";

type TaskRow = {
  id: number;
  title: string;
  body: string | null;
  status: "open" | "done" | "snoozed";
  dueAt: string | null;
  candidateId: number | null;
  jobId: number | null;
};

export function TasksCard({
  tasks,
  onCreate,
  onComplete,
  onSnooze,
  onDelete,
}: {
  tasks: TaskRow[];
  onCreate: (formData: FormData) => Promise<void>;
  onComplete: (id: number) => Promise<void>;
  onSnooze: (id: number, days: number) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [pending, start] = useTransition();

  const submit = () => {
    if (!title.trim()) return;
    const fd = new FormData();
    fd.set("title", title.trim());
    if (dueAt) fd.set("dueAt", dueAt);
    start(async () => {
      await onCreate(fd);
      setTitle("");
      setDueAt("");
      setOpen(false);
      toast.success("Task added");
    });
  };

  return (
    <div className="card overflow-hidden">
      <div className="px-5 py-4 border-b border-hairline flex items-center justify-between">
        <div className="text-sm font-semibold">My tasks</div>
        <button onClick={() => setOpen(true)} className="text-xs text-brand-700 hover:underline inline-flex items-center gap-1">
          <Plus size={12} /> Add
        </button>
      </div>

      {open && (
        <div className="px-5 py-3 border-b border-hairline space-y-2 bg-canvas/40">
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="What needs doing?"
            className="input h-9 text-sm"
            onKeyDown={(e) => {
              if (e.key === "Enter") { e.preventDefault(); submit(); }
              if (e.key === "Escape") { setOpen(false); setTitle(""); setDueAt(""); }
            }}
          />
          <div className="flex gap-2">
            <input
              type="date"
              value={dueAt}
              onChange={(e) => setDueAt(e.target.value)}
              className="input h-8 text-xs flex-1"
              placeholder="Due"
            />
            <button onClick={submit} disabled={pending || !title.trim()} className="btn-brand text-xs h-8 px-3 disabled:opacity-50">
              {pending ? "Adding…" : "Add task"}
            </button>
            <button onClick={() => { setOpen(false); setTitle(""); setDueAt(""); }} className="btn-ghost text-xs h-8 px-3">
              Cancel
            </button>
          </div>
        </div>
      )}

      {tasks.length === 0 ? (
        <div className="px-5 py-12 text-center text-sm text-ink-muted">
          No tasks. Add one above to remember a follow-up.
        </div>
      ) : (
        <ul className="divide-y divide-hairline">
          {tasks.map((t) => {
            const overdue = t.dueAt && new Date(t.dueAt) < new Date();
            return (
              <li key={t.id} className="px-5 py-3 group flex items-start gap-3">
                <CompleteButton id={t.id} onComplete={onComplete} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium leading-tight">{t.title}</div>
                  {t.body && <p className="text-xs text-ink-soft mt-0.5 line-clamp-2">{t.body}</p>}
                  <div className="text-[10px] text-ink-muted mt-1 flex items-center gap-2 flex-wrap">
                    {t.dueAt && (
                      <span className={`inline-flex items-center gap-0.5 ${overdue ? "text-red-600 font-medium" : ""}`}>
                        <Clock size={10} />
                        {new Date(t.dueAt).toLocaleDateString()}
                        {overdue && " · overdue"}
                      </span>
                    )}
                    {t.candidateId && (
                      <Link href={`/candidates/${t.candidateId}`} className="text-brand-700 hover:underline">
                        Candidate #{t.candidateId}
                      </Link>
                    )}
                    {t.jobId && (
                      <Link href={`/jobs/${t.jobId}`} className="text-brand-700 hover:underline">
                        Job #{t.jobId}
                      </Link>
                    )}
                  </div>
                </div>
                <details className="relative shrink-0">
                  <summary className="list-none cursor-pointer size-6 rounded-full opacity-0 group-hover:opacity-100 hover:bg-canvas inline-flex items-center justify-center">
                    <X size={12} className="text-ink-muted hover:text-ink" />
                  </summary>
                  <div className="absolute right-0 top-full mt-1 w-32 card p-1 z-30">
                    <SnoozeButton id={t.id} days={1} onSnooze={onSnooze} label="Tomorrow" />
                    <SnoozeButton id={t.id} days={3} onSnooze={onSnooze} label="In 3 days" />
                    <SnoozeButton id={t.id} days={7} onSnooze={onSnooze} label="Next week" />
                    <DeleteButton id={t.id} onDelete={onDelete} />
                  </div>
                </details>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function CompleteButton({ id, onComplete }: { id: number; onComplete: (id: number) => Promise<void> }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => start(async () => { await onComplete(id); toast.success("Task done"); })}
      className="size-5 rounded-full border-2 border-hairline hover:border-brand-500 hover:bg-brand-500 hover:text-white transition-colors inline-flex items-center justify-center text-transparent hover:text-white shrink-0 mt-0.5"
      aria-label="Complete task"
    >
      <Check size={12} />
    </button>
  );
}

function SnoozeButton({ id, days, onSnooze, label }: { id: number; days: number; onSnooze: (id: number, days: number) => Promise<void>; label: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => start(async () => { await onSnooze(id, days); toast.success(`Snoozed ${days}d`); })}
      className="w-full text-left text-xs px-2.5 h-7 rounded-md hover:bg-canvas"
    >
      {label}
    </button>
  );
}

function DeleteButton({ id, onDelete }: { id: number; onDelete: (id: number) => Promise<void> }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => start(async () => { await onDelete(id); toast.success("Task deleted"); })}
      className="w-full text-left text-xs px-2.5 h-7 rounded-md hover:bg-red-50 text-red-700"
    >
      Delete
    </button>
  );
}
