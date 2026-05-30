import { desc, eq, ilike, and, type SQL } from "drizzle-orm";
import Link from "next/link";
import { db } from "@/db";
import { auditLog } from "@/db/schema";
import { requireAdmin } from "@/lib/rbac";
import { PageHeader, Badge } from "@/components/primitives";

export const dynamic = "force-dynamic";
export const metadata = { title: "Audit log" };

const ACTIONS = ["all", "create", "update", "delete", "login", "logout", "view", "download", "submit", "feedback", "invite", "role_change"] as const;

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: Promise<{ actor?: string; action?: string }>;
}) {
  await requireAdmin();
  const sp = await searchParams;
  const actor = (sp.actor || "").trim();
  const action = sp.action;

  const conds: SQL[] = [];
  if (actor) conds.push(ilike(auditLog.actorEmail, `%${actor}%`));
  if (action && action !== "all") conds.push(eq(auditLog.action, action as "create"));
  const whereExpr = conds.length > 0 ? and(...conds) : undefined;

  const rows = await db.select().from(auditLog).where(whereExpr).orderBy(desc(auditLog.createdAt)).limit(500);

  return (
    <>
      <PageHeader
        title="Audit log"
        subtitle={`${rows.length} most recent entries (append-only)`}
        actions={
          <a href="/api/settings/audit-export" className="btn-ghost">Export CSV</a>
        }
      />

      <form className="card p-3 mb-4 flex flex-wrap gap-2 items-center">
        <input
          name="actor"
          defaultValue={actor}
          placeholder="Filter by actor email…"
          className="input h-9 max-w-[280px]"
        />
        <select name="action" defaultValue={action || "all"} className="input h-9 max-w-[180px]">
          {ACTIONS.map((a) => <option key={a} value={a}>{a === "all" ? "All actions" : a}</option>)}
        </select>
        <button type="submit" className="btn-primary text-xs h-9">Filter</button>
        {(actor || (action && action !== "all")) && (
          <Link href="/settings/audit" className="text-xs text-ink-soft hover:text-ink">Clear</Link>
        )}
      </form>

      {rows.length === 0 ? (
        <div className="card p-8 text-center text-sm text-ink-soft">No activity matches your filter.</div>
      ) : (
        <div className="card overflow-x-auto max-h-[70vh]">
          <table className="w-full text-sm min-w-[720px]">
            <thead className="text-xs text-ink-muted uppercase tracking-wide sticky top-0 bg-surface z-10 shadow-[0_1px_0_rgba(15,23,42,0.06)]">
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
