import Link from "next/link";
import { db } from "@/db";
import { emailTemplates } from "@/db/schema";
import { requireStaff } from "@/lib/rbac";
import { PageHeader, Badge } from "@/components/primitives";
import { TimeAgo } from "@/components/time-ago";
import { ChevronRight } from "lucide-react";
import { ToggleActiveButton } from "./toggle-active-button";

export const dynamic = "force-dynamic";
export const metadata = { title: "Email templates" };

const STAGE_ORDER = [
  "received",
  "hr_review",
  "screening",
  "submitted",
  "shortlist",
  "interview",
  "hold",
  "offer",
  "joined",
  "rejected",
];

export default async function EmailTemplatesPage() {
  await requireStaff();
  const rows = await db.select().from(emailTemplates);

  const sorted = [...rows].sort((a, b) => {
    const ai = STAGE_ORDER.findIndex((s) => a.slug === `stage:${s}`);
    const bi = STAGE_ORDER.findIndex((s) => b.slug === `stage:${s}`);
    if (ai === -1 && bi === -1) return a.slug.localeCompare(b.slug);
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });

  const activeCount = rows.filter((r) => r.isActive).length;

  return (
    <>
      <PageHeader
        title="Email templates"
        subtitle={`${activeCount} of ${rows.length} active — auto-fire when a candidate moves to that stage`}
      />

      {rows.length === 0 ? (
        <div className="card p-6 text-sm text-ink-soft">
          No templates seeded yet. Run <code className="px-1 bg-canvas rounded">db:seed</code> to install the defaults.
        </div>
      ) : (
        <div className="card divide-y divide-hairline">
          {sorted.map((t) => {
            const stage = t.slug.startsWith("stage:") ? t.slug.slice(6) : t.slug;
            return (
              <div key={t.id} className="flex items-center gap-3 px-4 py-3">
                <Badge tone={t.isActive ? "green" : "default"} className="capitalize w-24 justify-center">
                  {stage.replaceAll("_", " ")}
                </Badge>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{t.name}</div>
                  <div className="text-xs text-ink-soft truncate">{t.subject}</div>
                </div>
                <div className="hidden md:flex flex-col text-right text-[11px] text-ink-muted shrink-0">
                  <span>edited</span>
                  <span><TimeAgo date={t.updatedAt} /></span>
                </div>
                <ToggleActiveButton slug={t.slug} isActive={t.isActive} />
                <Link
                  href={`/settings/email-templates/${encodeURIComponent(t.slug)}/edit`}
                  className="btn-ghost text-xs inline-flex items-center gap-1"
                >
                  Edit <ChevronRight size={14} />
                </Link>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-6 card p-4 bg-canvas/40">
        <div className="text-xs font-semibold mb-1">How auto-emails fire</div>
        <ul className="text-xs text-ink-soft space-y-1 list-disc pl-4">
          <li>When a candidate moves to a stage (manually, via Kanban, via bulk action, or via job-submission), the matching <code className="bg-surface px-1 rounded">stage:&lt;name&gt;</code> template is rendered and emailed to the candidate.</li>
          <li>Templates marked <strong>inactive</strong> are silent — no email and no outbox row.</li>
          <li>If the candidate has no email address, the send is skipped.</li>
          <li>Send failures are logged in the email outbox with a status of <code className="bg-surface px-1 rounded">failed</code> so HR can re-attempt.</li>
        </ul>
      </div>
    </>
  );
}
