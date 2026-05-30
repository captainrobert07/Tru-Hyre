import { desc } from "drizzle-orm";
import { db } from "@/db";
import { auditLog } from "@/db/schema";
import { requireAdmin } from "@/lib/rbac";
import { PageHeader, Badge } from "@/components/primitives";

export const dynamic = "force-dynamic";
export const metadata = { title: "Audit log" };

export default async function AuditLogPage() {
  await requireAdmin();
  const rows = await db.select().from(auditLog).orderBy(desc(auditLog.createdAt)).limit(500);

  return (
    <>
      <PageHeader title="Audit log" subtitle={`${rows.length} most recent entries (append-only)`} />
      {rows.length === 0 ? (
        <div className="card p-8 text-center text-sm text-ink-soft">No activity yet.</div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm min-w-[720px]">
            <thead className="text-xs text-ink-muted uppercase tracking-wide">
              <tr className="border-b border-hairline">
                <th className="text-left font-medium py-2.5 px-4">When</th>
                <th className="text-left font-medium py-2.5 px-4">Actor</th>
                <th className="text-left font-medium py-2.5 px-4">Action</th>
                <th className="text-left font-medium py-2.5 px-4">Target</th>
                <th className="text-left font-medium py-2.5 px-4">Summary</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-canvas">
                  <td className="py-2 px-4 text-ink-muted whitespace-nowrap">{new Date(r.createdAt).toLocaleString()}</td>
                  <td className="py-2 px-4 truncate max-w-[200px]">{r.actorEmail || "—"}</td>
                  <td className="py-2 px-4"><Badge tone="default">{r.action}</Badge></td>
                  <td className="py-2 px-4 text-ink-soft text-xs">{r.targetType ? `${r.targetType}#${r.targetId || ""}` : "—"}</td>
                  <td className="py-2 px-4 truncate max-w-[300px]">{r.summary}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
