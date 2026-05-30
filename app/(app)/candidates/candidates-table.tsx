"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Eye } from "lucide-react";
import { useConfirm } from "@/components/confirm";
import { SlideOver } from "@/components/slide-over";
import { StageBadge, Badge } from "@/components/primitives";
import { Avatar } from "@/components/avatar";
import { useListKeyboard } from "@/components/use-list-keyboard";
import { bulkCandidateAction } from "./bulk-actions";

type Row = {
  id: number;
  fullName: string;
  currentTitle: string | null;
  location: string | null;
  experienceYears: string | null;
  stage: string;
  refId: string;
};

type Preview = {
  id: number;
  refId: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  location: string | null;
  currentTitle: string | null;
  currentCompany: string | null;
  experienceYears: string | null;
  noticePeriodDays: number | null;
  currentCtc: string | null;
  expectedCtc: string | null;
  summary: string | null;
  skills: string[];
  stage: string;
  vendorName: string | null;
};

const STAGES = ["received", "hr_review", "screening", "submitted", "shortlist", "interview", "hold", "offer", "joined", "rejected"] as const;

export function CandidatesTable({
  rows,
  isAdmin,
  vendors,
}: {
  rows: Row[];
  isAdmin: boolean;
  vendors: { id: number; name: string }[];
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [pending, start] = useTransition();
  const [preview, setPreview] = useState<Preview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

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

  const { focusedId } = useListKeyboard({
    rows: rows.map((r) => ({ id: r.id, href: `/candidates/${r.id}` })),
    onToggleSelect: toggleOne,
  });

  const runBulk = (input: Parameters<typeof bulkCandidateAction>[0]) => {
    start(async () => {
      const r = await bulkCandidateAction(input);
      if (r.ok) {
        toast.success(`Updated ${r.affected} candidate${r.affected === 1 ? "" : "s"}`);
        clear();
        router.refresh();
      } else {
        toast.error(r.error);
      }
    });
  };

  const onSetStage = (stage: (typeof STAGES)[number]) => runBulk({ ids: [...selected], action: "set_stage", stage });
  const onAssignVendor = (vendorId: number | null) => runBulk({ ids: [...selected], action: "assign_vendor", vendorId });
  const onBulkDelete = async () => {
    const ok = await confirm({
      title: `Delete ${selected.size} candidate${selected.size === 1 ? "" : "s"}?`,
      description: "Removes resumes, packets, history, and submissions. This is irreversible. Audit log entries survive.",
      destructive: true,
      typeToConfirm: `delete ${selected.size}`,
      confirmLabel: "Delete forever",
    });
    if (!ok) return;
    runBulk({ ids: [...selected], action: "delete" });
  };

  const openPreview = async (id: number) => {
    setPreviewLoading(true);
    setPreview({ id } as Preview); // open shell
    try {
      const r = await fetch(`/api/candidates/${id}/preview`);
      if (!r.ok) throw new Error("Failed to load preview");
      const data = (await r.json()) as Preview;
      setPreview(data);
    } catch (e) {
      toast.error((e as Error).message);
      setPreview(null);
    } finally {
      setPreviewLoading(false);
    }
  };

  return (
    <>
      {selected.size > 0 && (
        <div className="sticky top-[68px] z-30 mb-3 card flex items-center gap-2 px-3 py-2 flex-wrap shadow-pop">
          <span className="text-sm font-medium px-2">{selected.size} selected</span>
          <button onClick={clear} className="text-xs text-ink-soft hover:text-ink px-2">Clear</button>

          <div className="ml-auto flex flex-wrap gap-1.5">
            {selected.size >= 2 && selected.size <= 4 && (
              <Link
                href={`/candidates/compare?ids=${[...selected].join(",")}`}
                className="text-xs px-3 h-8 rounded-full bg-brand-50 text-brand-700 hover:bg-brand-100 inline-flex items-center"
              >
                Compare ({selected.size})
              </Link>
            )}

            <details className="relative">
              <summary className="list-none cursor-pointer text-xs px-3 h-8 rounded-full bg-canvas hover:bg-surface inline-flex items-center gap-1 select-none">Move to stage ▾</summary>
              <div className="absolute right-0 top-full mt-2 w-48 card p-1 z-50">
                {STAGES.map((s) => (
                  <button key={s} type="button" disabled={pending} onClick={() => onSetStage(s)} className="w-full text-left px-3 h-8 rounded-md text-xs hover:bg-canvas capitalize">
                    {s.replaceAll("_", " ")}
                  </button>
                ))}
              </div>
            </details>

            <details className="relative">
              <summary className="list-none cursor-pointer text-xs px-3 h-8 rounded-full bg-canvas hover:bg-surface inline-flex items-center gap-1 select-none">Assign vendor ▾</summary>
              <div className="absolute right-0 top-full mt-2 w-56 card p-1 z-50 max-h-72 overflow-y-auto">
                <button type="button" disabled={pending} onClick={() => onAssignVendor(null)} className="w-full text-left px-3 h-8 rounded-md text-xs hover:bg-canvas text-ink-soft">— Unassign —</button>
                {vendors.map((v) => (
                  <button key={v.id} type="button" disabled={pending} onClick={() => onAssignVendor(v.id)} className="w-full text-left px-3 h-8 rounded-md text-xs hover:bg-canvas truncate">
                    {v.name}
                  </button>
                ))}
              </div>
            </details>

            {isAdmin && (
              <button type="button" disabled={pending} onClick={onBulkDelete} className="text-xs px-3 h-8 rounded-full text-red-700 hover:bg-red-50 border border-red-100">Delete</button>
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
            aria-label="Select all"
          />
          <span className="flex-1">Candidate</span>
          <span className="hidden md:inline">Stage</span>
        </div>

        {rows.map((c) => {
          const checked = selected.has(c.id);
          const focused = focusedId === c.id;
          return (
            <div
              key={c.id}
              id={`row-${c.id}`}
              className={`group px-5 py-3 flex items-center gap-3 transition-colors ${
                focused ? "bg-brand-50/60 ring-1 ring-inset ring-brand-200" : checked ? "bg-brand-50/40" : "hover:bg-canvas"
              }`}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => toggleOne(c.id)}
                className="size-4 rounded border-hairline text-brand-500 focus:ring-brand-500"
                aria-label={`Select ${c.fullName}`}
              />
              <Avatar name={c.fullName} size="sm" />
              <Link href={`/candidates/${c.id}`} className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate flex items-center gap-2">
                  {c.fullName}
                  <span className="text-[10px] text-ink-muted font-mono">{c.refId}</span>
                </div>
                <div className="text-xs text-ink-soft truncate mt-0.5">
                  {[c.currentTitle, c.location, c.experienceYears ? `${c.experienceYears} yrs` : null].filter(Boolean).join(" · ")}
                </div>
              </Link>
              <button
                type="button"
                onClick={() => openPreview(c.id)}
                className="size-8 rounded-full text-ink-muted hover:text-ink hover:bg-surface inline-flex items-center justify-center opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity"
                aria-label={`Preview ${c.fullName}`}
                title="Quick preview"
              >
                <Eye size={14} />
              </button>
              <StageBadge stage={c.stage} />
            </div>
          );
        })}
      </div>

      <SlideOver
        open={preview !== null}
        onClose={() => setPreview(null)}
        title={preview?.fullName || "Loading…"}
        subtitle={preview?.refId}
      >
        {previewLoading || !preview?.refId ? (
          <div className="space-y-3">
            <div className="h-4 w-32 bg-canvas rounded animate-pulse" />
            <div className="h-24 bg-canvas rounded animate-pulse" />
            <div className="h-12 bg-canvas rounded animate-pulse" />
          </div>
        ) : preview ? (
          <PreviewBody p={preview} />
        ) : null}
      </SlideOver>
    </>
  );
}

function PreviewBody({ p }: { p: Preview }) {
  const fmt = (v: string | null) => {
    if (!v) return "—";
    const n = Number(v);
    if (Number.isNaN(n)) return v;
    return n.toLocaleString("en-IN");
  };
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 flex-wrap">
        <StageBadge stage={p.stage} />
        {p.vendorName && <Badge tone="default">via {p.vendorName}</Badge>}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Stat label="Experience" value={p.experienceYears ? `${p.experienceYears} yrs` : "—"} />
        <Stat label="Notice" value={p.noticePeriodDays ? `${p.noticePeriodDays}d` : "—"} />
        <Stat label="Current CTC" value={fmt(p.currentCtc)} />
        <Stat label="Expected CTC" value={fmt(p.expectedCtc)} />
      </div>

      <Section title="Profile">
        <Field label="Email" value={p.email} />
        <Field label="Phone" value={p.phone} />
        <Field label="Location" value={p.location} />
        <Field label="Title" value={p.currentTitle} />
        <Field label="Company" value={p.currentCompany} />
      </Section>

      {p.summary && (
        <Section title="Summary">
          <p className="text-sm leading-relaxed">{p.summary}</p>
        </Section>
      )}

      {p.skills && p.skills.length > 0 && (
        <Section title="Skills">
          <div className="flex flex-wrap gap-1.5">
            {p.skills.map((s) => <Badge key={s} tone="green">{s}</Badge>)}
          </div>
        </Section>
      )}

      <div className="pt-3 border-t border-hairline">
        <Link href={`/candidates/${p.id}`} className="btn-primary w-full justify-center">
          Open full profile →
        </Link>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="text-xs uppercase tracking-wide text-ink-muted mb-2">{title}</h3>
      {children}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="card p-3">
      <div className="text-[11px] text-ink-muted uppercase tracking-wide">{label}</div>
      <div className="text-base font-semibold tabular-nums mt-1">{value}</div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="grid grid-cols-3 gap-2 py-1.5 text-sm">
      <div className="text-ink-muted text-xs uppercase tracking-wide pt-0.5">{label}</div>
      <div className="col-span-2 truncate">{value || "—"}</div>
    </div>
  );
}
