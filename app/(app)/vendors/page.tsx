import { desc, count, eq, ilike, or, and, type SQL } from "drizzle-orm";
import Link from "next/link";
import { db } from "@/db";
import { vendorAccounts, candidates } from "@/db/schema";
import { requireStaff } from "@/lib/rbac";
import { parseListParams } from "@/lib/list-params";
import { PageHeader, ListRow, EmptyState, Badge } from "@/components/primitives";
import { ListToolbar, Pager } from "@/components/list-toolbar";

export const dynamic = "force-dynamic";
export const metadata = { title: "Vendors" };

export default async function VendorsPage({
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
      ilike(vendorAccounts.name, like),
      ilike(vendorAccounts.country, like),
      ilike(vendorAccounts.contactName, like),
      ilike(vendorAccounts.contactEmail, like),
    );
    if (orExpr) conditions.push(orExpr);
  }
  const whereExpr = conditions.length > 0 ? and(...conditions) : undefined;

  const [rows, totalRows] = await Promise.all([
    db
      .select({
        id: vendorAccounts.id,
        name: vendorAccounts.name,
        country: vendorAccounts.country,
        contactName: vendorAccounts.contactName,
        candCount: count(candidates.id),
      })
      .from(vendorAccounts)
      .leftJoin(candidates, eq(candidates.vendorAccountId, vendorAccounts.id))
      .where(whereExpr)
      .groupBy(vendorAccounts.id)
      .orderBy(desc(vendorAccounts.createdAt))
      .limit(pageSize)
      .offset(offset),
    db.select({ n: count() }).from(vendorAccounts).where(whereExpr),
  ]);
  const total = totalRows[0]?.n ?? 0;

  return (
    <>
      <PageHeader
        title="Vendors"
        subtitle={`${total} vendor${total === 1 ? "" : "s"}${q ? ` matching "${q}"` : ""}`}
        actions={<Link href="/vendors/new" className="btn-primary">New vendor</Link>}
      />
      <ListToolbar basePath="/vendors" placeholder="Search by name, country, or contact…" />
      {rows.length === 0 ? (
        <EmptyState
          title={q ? "No matches" : "No vendors yet"}
          cta={!q ? { href: "/vendors/new", label: "Add your first vendor" } : undefined}
        />
      ) : (
        <>
          <div className="card overflow-hidden divide-y divide-hairline">
            {rows.map((v) => (
              <ListRow
                key={v.id}
                href={`/vendors/${v.id}`}
                primary={v.name}
                secondary={[v.country, v.contactName].filter(Boolean).join(" · ") || undefined}
                trailing={<Badge tone="default">{v.candCount} candidate{v.candCount === 1 ? "" : "s"}</Badge>}
              />
            ))}
          </div>
          <Pager basePath="/vendors" page={page} pageSize={pageSize} total={total} q={q} />
        </>
      )}
    </>
  );
}
