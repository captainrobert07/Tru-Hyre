import { desc, count, eq, ilike, or, and, type SQL } from "drizzle-orm";
import Link from "next/link";
import { db } from "@/db";
import { clientAccounts, jobs } from "@/db/schema";
import { requireStaff } from "@/lib/rbac";
import { parseListParams } from "@/lib/list-params";
import { PageHeader, EmptyState, Badge } from "@/components/primitives";
import { ListToolbar, Pager } from "@/components/list-toolbar";
import { BulkList } from "@/components/bulk-list";
import { Avatar } from "@/components/avatar";
import { bulkClientAction } from "./bulk-actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Clients" };

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  await requireStaff();
  const sp = await searchParams;
  const { q, page, pageSize, offset } = parseListParams(sp);

  const conditions: SQL[] = [];
  if (q) {
    const like = `%${q}%`;
    const orExpr = or(
      ilike(clientAccounts.name, like),
      ilike(clientAccounts.industry, like),
      ilike(clientAccounts.primaryContactName, like),
      ilike(clientAccounts.primaryContactEmail, like),
    );
    if (orExpr) conditions.push(orExpr);
  }
  const whereExpr = conditions.length > 0 ? and(...conditions) : undefined;

  const [rows, totalRows] = await Promise.all([
    db
      .select({
        id: clientAccounts.id,
        name: clientAccounts.name,
        industry: clientAccounts.industry,
        primaryContactName: clientAccounts.primaryContactName,
        jobCount: count(jobs.id),
      })
      .from(clientAccounts)
      .leftJoin(jobs, eq(jobs.clientAccountId, clientAccounts.id))
      .where(whereExpr)
      .groupBy(clientAccounts.id)
      .orderBy(desc(clientAccounts.createdAt))
      .limit(pageSize)
      .offset(offset),
    db.select({ n: count() }).from(clientAccounts).where(whereExpr),
  ]);
  const total = totalRows[0]?.n ?? 0;

  return (
    <>
      <PageHeader
        title="Clients"
        subtitle={`${total} client${total === 1 ? "" : "s"}${q ? ` matching "${q}"` : ""}`}
        actions={<Link href="/clients/new" className="btn-primary">New client</Link>}
      />
      <ListToolbar basePath="/clients" placeholder="Search by name, industry, or contact…" />
      {rows.length === 0 ? (
        <EmptyState
          title={q ? "No matches" : "No clients yet"}
          cta={!q ? { href: "/clients/new", label: "Add your first client" } : undefined}
        />
      ) : (
        <>
          <BulkList
            rows={rows.map((c) => ({
              id: c.id,
              href: `/clients/${c.id}`,
              primary: (
                <span className="inline-flex items-center gap-2">
                  <Avatar name={c.name} size="sm" />
                  {c.name}
                </span>
              ),
              secondary: [c.industry, c.primaryContactName].filter(Boolean).join(" · ") || undefined,
              trailing: <Badge tone="default">{c.jobCount} job{c.jobCount === 1 ? "" : "s"}</Badge>,
            }))}
            actions={[
              {
                kind: "destructive",
                label: "Delete",
                confirmTitle: (n) => `Delete ${n} client${n === 1 ? "" : "s"}?`,
                confirmDescription: "Removes the client account and cascade-deletes their jobs, contacts, and submissions. Audit log entries survive.",
                run: async (ids) => {
                  "use server";
                  return await bulkClientAction({ ids, action: "delete" });
                },
              },
            ]}
          />
          <Pager basePath="/clients" page={page} pageSize={pageSize} total={total} q={q} />
        </>
      )}
    </>
  );
}
