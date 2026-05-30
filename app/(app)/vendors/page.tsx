import { desc, count, eq } from "drizzle-orm";
import Link from "next/link";
import { db } from "@/db";
import { vendorAccounts, candidates } from "@/db/schema";
import { requireStaff } from "@/lib/rbac";
import { PageHeader, ListRow, EmptyState, Badge } from "@/components/primitives";

export const dynamic = "force-dynamic";

export default async function VendorsPage() {
  await requireStaff();
  const rows = await db
    .select({
      id: vendorAccounts.id,
      name: vendorAccounts.name,
      country: vendorAccounts.country,
      contactName: vendorAccounts.contactName,
      candCount: count(candidates.id),
    })
    .from(vendorAccounts)
    .leftJoin(candidates, eq(candidates.vendorAccountId, vendorAccounts.id))
    .groupBy(vendorAccounts.id)
    .orderBy(desc(vendorAccounts.createdAt));

  return (
    <>
      <PageHeader
        title="Vendors"
        subtitle={`${rows.length} vendor${rows.length === 1 ? "" : "s"}`}
        actions={<Link href="/vendors/new" className="btn-primary">New vendor</Link>}
      />
      {rows.length === 0 ? (
        <EmptyState title="No vendors yet" cta={{ href: "/vendors/new", label: "Add your first vendor" }} />
      ) : (
        <div className="card overflow-hidden divide-y divide-hairline">
          {rows.map((v) => (
            <ListRow
              key={v.id}
              href={`/vendors/${v.id}`}
              primary={v.name}
              secondary={[v.country, v.contactName].filter(Boolean).join(" · ") || "—"}
              trailing={<Badge tone="default">{v.candCount} candidate{v.candCount === 1 ? "" : "s"}</Badge>}
            />
          ))}
        </div>
      )}
    </>
  );
}
