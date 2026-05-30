import { desc, count, eq, ilike, or, and, type SQL } from "drizzle-orm";
import Link from "next/link";
import { db } from "@/db";
import { jobs, clientAccounts } from "@/db/schema";
import { requireStaff } from "@/lib/rbac";
import { parseListParams } from "@/lib/list-params";
import { PageHeader, EmptyState } from "@/components/primitives";
import { ListToolbar, Pager } from "@/components/list-toolbar";
import { JobsBulkTable } from "./jobs-bulk-table";

export const dynamic = "force-dynamic";
export const metadata = { title: "Jobs" };

const STATUS_OPTIONS = ["all", "open", "hold", "closing", "closed"];

export default async function JobsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string; status?: string }>;
}) {
  await requireStaff();
  const sp = await searchParams;
  const { q, page, pageSize, offset } = parseListParams(sp);
  const status = sp.status;

  const conditions: SQL[] = [];
  if (q) {
    const like = `%${q}%`;
    const orExpr = or(
      ilike(jobs.title, like),
      ilike(jobs.location, like),
      ilike(clientAccounts.name, like),
    );
    if (orExpr) conditions.push(orExpr);
  }
  if (status && status !== "all") conditions.push(eq(jobs.status, status as "open" | "hold" | "closing" | "closed"));
  const whereExpr = conditions.length > 0 ? and(...conditions) : undefined;

  const [rows, totalRows] = await Promise.all([
    db
      .select({
        id: jobs.id,
        title: jobs.title,
        status: jobs.status,
        priority: jobs.priority,
        location: jobs.location,
        positions: jobs.positions,
        clientName: clientAccounts.name,
      })
      .from(jobs)
      .leftJoin(clientAccounts, eq(jobs.clientAccountId, clientAccounts.id))
      .where(whereExpr)
      .orderBy(desc(jobs.createdAt))
      .limit(pageSize)
      .offset(offset),
    db.select({ n: count() }).from(jobs).leftJoin(clientAccounts, eq(jobs.clientAccountId, clientAccounts.id)).where(whereExpr),
  ]);
  const total = totalRows[0]?.n ?? 0;

  return (
    <>
      <PageHeader
        title="Jobs"
        subtitle={`${total} job${total === 1 ? "" : "s"}${q ? ` matching "${q}"` : ""}`}
        actions={<Link href="/jobs/new" className="btn-primary">New job</Link>}
      />

      <ListToolbar
        basePath="/jobs"
        placeholder="Search by title, client, or location…"
        extra={
          <div className="flex flex-wrap gap-1">
            {STATUS_OPTIONS.map((s) => {
              const active = (status || "all") === s;
              const params = new URLSearchParams();
              if (q) params.set("q", q);
              if (s !== "all") params.set("status", s);
              const href = `/jobs${params.toString() ? `?${params}` : ""}`;
              return (
                <Link
                  key={s}
                  href={href}
                  className={`text-xs px-3 h-9 rounded-full inline-flex items-center transition-colors ${
                    active ? "bg-ink_inverted text-white" : "bg-canvas text-ink-soft hover:text-ink"
                  }`}
                >
                  {s}
                </Link>
              );
            })}
          </div>
        }
      />

      {rows.length === 0 ? (
        <EmptyState
          title={q || status ? "No matches" : "No jobs yet"}
          cta={!q && !status ? { href: "/jobs/new", label: "Create job" } : undefined}
        />
      ) : (
        <>
          <JobsBulkTable rows={rows.map((j) => ({
            id: j.id,
            title: j.title,
            status: j.status,
            location: j.location,
            positions: j.positions,
            clientName: j.clientName,
          }))} />
          <Pager basePath="/jobs" page={page} pageSize={pageSize} total={total} q={q} status={status} />
        </>
      )}
    </>
  );
}
