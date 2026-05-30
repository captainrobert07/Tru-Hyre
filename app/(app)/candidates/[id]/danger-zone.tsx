"use client";

import { useTransition } from "react";

export function DangerZone({
  candidateId,
  candidateName,
  exportHref,
  isAdmin,
  onDelete,
}: {
  candidateId: number;
  candidateName: string;
  exportHref: string;
  isAdmin: boolean;
  onDelete: () => Promise<void>;
}) {
  const [pending, start] = useTransition();

  const handleDelete = () => {
    const confirmed = window.confirm(
      `GDPR delete ${candidateName}?\n\nThis permanently removes the candidate, every resume file, every packet, every stage transition, every submission, and every feedback event.\n\nAn audit log entry survives. Type the candidate name in the next prompt to confirm.`,
    );
    if (!confirmed) return;
    const typed = window.prompt(`Type "${candidateName}" to confirm delete:`);
    if ((typed || "").trim() !== candidateName) {
      window.alert("Names don't match. Cancelled.");
      return;
    }
    start(() => onDelete());
  };

  return (
    <section className="card p-4 border-red-100 bg-red-50/30 mt-4">
      <h3 className="text-sm font-semibold text-red-700 mb-2">Compliance</h3>
      <div className="space-y-2 text-sm">
        <a href={exportHref} className="btn-ghost text-xs w-full">
          Export full data (JSON)
        </a>
        {isAdmin && (
          <button
            type="button"
            disabled={pending}
            onClick={handleDelete}
            className="text-xs w-full px-3 h-9 rounded-full border border-red-200 text-red-700 bg-white hover:bg-red-50 disabled:opacity-50 transition-colors"
          >
            {pending ? "Deleting…" : "GDPR delete (irreversible)"}
          </button>
        )}
      </div>
      <p className="text-[11px] text-ink-muted mt-2">
        Export is logged. Delete is irreversible and admin-only.
      </p>
    </section>
  );
}
