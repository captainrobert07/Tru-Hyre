"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, X, Calendar, PauseCircle } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { Badge } from "@/components/primitives";
import { useConfirm } from "@/components/confirm";
import {
  quickClientFeedbackAction,
  bulkClientFeedbackAction,
} from "./actions";

export type SubmissionRow = {
  id: number;
  candidateId: number;
  candidateName: string;
  candidateRefId: string;
  candidateTitle: string | null;
  starred: boolean;
  jobId: number;
  jobTitle: string;
  status: string;
  createdAt: string;
};

type Decision = "shortlist" | "reject" | "interview" | "hold";

const TONE: Record<string, "blue" | "green" | "amber" | "red" | "default"> = {
  submitted: "blue",
  shortlist: "green",
  interview: "amber",
  hold: "amber",
  reject: "red",
  offer: "green",
  joined: "green",
};

export function ClientSubmissionsList({ rows }: { rows: SubmissionRow[] }) {
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

  const handleSingle = (submissionId: number, kind: Decision) => {
    start(async () => {
      const r = await quickClientFeedbackAction(submissionId, kind);
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      const prev = r.previousStatus;
      // Show toast with Undo if there was a real prior status
      if (prev && prev !== kind) {
        toast.success(LABEL[kind], {
          action: {
            label: "Undo",
            onClick: () => {
              start(async () => {
                const undo = await quickClientFeedbackAction(submissionId, prev as Decision | "submitted");
                if (undo.ok) {
                  toast.success(`Reverted to ${prev}`);
                  router.refresh();
                } else {
                  toast.error(undo.error);
                }
              });
            },
          },
          duration: 8000,
        });
      } else {
        toast.success(LABEL[kind]);
      }
      router.refresh();
    });
  };

  const handleBulk = async (kind: Decision) => {
    if (kind === "reject") {
      const ok = await confirm({
        title: `Reject ${selected.size} candidate${selected.size === 1 ? "" : "s"}?`,
        description: "This sends a reject decision to your recruiter for each selected candidate. You can't undo it from this view.",
        destructive: true,
        confirmLabel: "Reject all",
      });
      if (!ok) return;
    }
    start(async () => {
      const r = await bulkClientFeedbackAction([...selected], kind);
      if (r.ok) {
        toast.success(`${LABEL[kind]} on ${r.affected} candidate${r.affected === 1 ? "" : "s"}`);
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
        <div className="sticky top-2 z-30 mb-3 card flex items-center gap-2 px-3 py-2 flex-wrap shadow-pop">
          <span className="text-sm font-medium px-2">{selected.size} selected</span>
          <button onClick={clear} className="text-xs text-ink-soft hover:text-ink px-2">Clear</button>
          <div className="ml-auto flex flex-wrap gap-1.5">
            <BulkBtn onClick={() => handleBulk("shortlist")} pending={pending} tone="brand">
              <Check size={12} /> Shortlist
            </BulkBtn>
            <BulkBtn onClick={() => handleBulk("interview")} pending={pending} tone="amber">
              <Calendar size={12} /> Interview
            </BulkBtn>
            <BulkBtn onClick={() => handleBulk("hold")} pending={pending} tone="default">
              <PauseCircle size={12} /> Hold
            </BulkBtn>
            <BulkBtn onClick={() => handleBulk("reject")} pending={pending} tone="red">
              <X size={12} /> Reject
            </BulkBtn>
          </div>
        </div>
      )}

      <div className="card overflow-hidden divide-y divide-hairline">
        <div className="px-4 py-3 flex items-center gap-3 bg-canvas/50 text-[11px] uppercase tracking-wide text-ink-muted">
          <input
            type="checkbox"
            checked={allChecked}
            ref={(el) => { if (el) el.indeterminate = someChecked; }}
            onChange={toggleAll}
            className="size-4 rounded border-hairline text-brand-500 focus:ring-brand-500"
            aria-label="Select all"
          />
          <span className="flex-1">Candidate</span>
          <span className="hidden md:inline">Decide</span>
        </div>

        {rows.map((s) => {
          const checked = selected.has(s.id);
          const decided = ["shortlist", "interview", "hold", "reject", "offer", "joined"].includes(s.status);
          return (
            <div
              key={s.id}
              className={`group px-4 py-3 flex items-center gap-3 transition-colors ${
                checked ? "bg-brand-50/40" : "hover:bg-canvas"
              }`}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => toggleOne(s.id)}
                className="size-4 rounded border-hairline text-brand-500 focus:ring-brand-500"
                aria-label={`Select ${s.candidateName}`}
              />
              <Avatar name={s.candidateName} size="sm" />
              <Link href={`/portal/client/submissions/${s.id}`} className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate flex items-center gap-2">
                  {s.starred && <span className="text-amber-500" aria-label="starred">★</span>}
                  {s.candidateName}
                  <span className="text-[10px] text-ink-muted font-mono">{s.candidateRefId}</span>
                </div>
                <div className="text-xs text-ink-soft truncate mt-0.5">
                  {s.candidateTitle ? `${s.candidateTitle} · ` : ""}
                  for <span className="text-ink">{s.jobTitle}</span>
                </div>
              </Link>

              {decided ? (
                <Badge tone={TONE[s.status] || "default"} className="shrink-0">
                  {s.status}
                </Badge>
              ) : (
                <div className="flex items-center gap-1 shrink-0">
                  <DecisionBtn
                    onClick={() => handleSingle(s.id, "shortlist")}
                    pending={pending}
                    title="Shortlist"
                    tone="brand"
                  >
                    <Check size={14} />
                  </DecisionBtn>
                  <DecisionBtn
                    onClick={() => handleSingle(s.id, "interview")}
                    pending={pending}
                    title="Move to interview"
                    tone="amber"
                  >
                    <Calendar size={14} />
                  </DecisionBtn>
                  <DecisionBtn
                    onClick={() => handleSingle(s.id, "hold")}
                    pending={pending}
                    title="Hold"
                    tone="default"
                  >
                    <PauseCircle size={14} />
                  </DecisionBtn>
                  <DecisionBtn
                    onClick={() => handleSingle(s.id, "reject")}
                    pending={pending}
                    title="Reject"
                    tone="red"
                  >
                    <X size={14} />
                  </DecisionBtn>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}

const LABEL: Record<Decision, string> = {
  shortlist: "Shortlisted",
  interview: "Moved to interview",
  hold: "Put on hold",
  reject: "Rejected",
};

function DecisionBtn({
  onClick,
  pending,
  title,
  tone,
  children,
}: {
  onClick: () => void;
  pending: boolean;
  title: string;
  tone: "brand" | "amber" | "default" | "red";
  children: React.ReactNode;
}) {
  const cls = {
    brand: "text-brand-700 hover:bg-brand-50 border-brand-100",
    amber: "text-amber-700 hover:bg-amber-50 border-amber-100",
    default: "text-ink-soft hover:bg-canvas border-hairline",
    red: "text-red-700 hover:bg-red-50 border-red-100",
  }[tone];
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      title={title}
      aria-label={title}
      className={`size-8 rounded-full border bg-surface inline-flex items-center justify-center transition-colors disabled:opacity-50 ${cls}`}
    >
      {children}
    </button>
  );
}

function BulkBtn({
  onClick,
  pending,
  tone,
  children,
}: {
  onClick: () => void;
  pending: boolean;
  tone: "brand" | "amber" | "default" | "red";
  children: React.ReactNode;
}) {
  const cls = {
    brand: "bg-brand-50 text-brand-700 hover:bg-brand-100 border-brand-100",
    amber: "bg-amber-50 text-amber-700 hover:bg-amber-100 border-amber-100",
    default: "bg-canvas text-ink-soft hover:bg-surface border-hairline",
    red: "bg-red-50 text-red-700 hover:bg-red-100 border-red-100",
  }[tone];
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      className={`text-xs px-3 h-8 rounded-full border inline-flex items-center gap-1.5 transition-colors disabled:opacity-50 ${cls}`}
    >
      {children}
    </button>
  );
}
