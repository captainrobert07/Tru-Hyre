import { redirect } from "next/navigation";
import { desc } from "drizzle-orm";
import { db } from "@/db";
import { auditLog } from "@/db/schema";
import { requireStaff } from "@/lib/rbac";
import { isFeatureEnabled } from "@/lib/features";
import { PageHeader, Badge } from "@/components/primitives";
import { TimeAgo } from "@/components/time-ago";

export const dynamic = "force-dynamic";
export const metadata = { title: "Activity" };

const ACTION_TONE: Record<string, "green" | "amber" | "red" | "blue" | "default"> = {
  create: "green",
  update: "blue",
  delete: "red",
  email_send: "blue",
  feedback: "amber",
  submit: "green",
  interview_schedule: "blue",
  interview_cancel: "red",
};

export default async function ActivityPage() {
  await requireStaff();
  if (!(await isFeatureEnabled("activity_feed"))) redirect("/dashboard");

  const rows = await db
    .select({
      id: auditLog.id,
      actorEmail: auditLog.actorEmail,
      action: auditLog.action,
      summary: auditLog.summary,
      targetType: auditLog.targetType,
      createdAt: auditLog.createdAt,
    })
    .from(auditLog)
    .orderBy(desc(auditLog.createdAt))
    .limit(150);

  return (
    <>
      <PageHeader title="Activity" subtitle="Recent actions across Tru Hyre." />
      {rows.length === 0 ? (
        <div className="card p-10 text-center text-ink-muted">No activity recorded yet.</div>
      ) : (
        <div className="card divide-y divide-hairline">
          {rows.map((r) => (
            <div key={r.id} className="flex items-start gap-3 px-4 py-3">
              <Badge tone={ACTION_TONE[r.action] || "default"}>{r.action.replaceAll("_", " ")}</Badge>
              <div className="min-w-0 flex-1">
                <div className="text-sm truncate">{r.summary}</div>
                <div className="text-[11px] text-ink-muted">
                  {r.actorEmail || "system"} · <TimeAgo date={r.createdAt} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
