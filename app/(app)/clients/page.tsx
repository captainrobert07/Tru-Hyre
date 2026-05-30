import { desc, count, eq } from "drizzle-orm";
import Link from "next/link";
import { db } from "@/db";
import { clientAccounts, jobs } from "@/db/schema";
import { requireStaff } from "@/lib/rbac";
import { PageHeader, ListRow, EmptyState, Badge } from "@/components/primitives";

export const dynamic = "force-dynamic";

export default async function ClientsPage() {
  await requireStaff();
  const rows = await db
    .select({
      id: clientAccounts.id,
      name: clientAccounts.name,
      industry: clientAccounts.industry,
      primaryContactName: clientAccounts.primaryContactName,
      jobCount: count(jobs.id),
    })
    .from(clientAccounts)
    .leftJoin(jobs, eq(jobs.clientAccountId, clientAccounts.id))
    .groupBy(clientAccounts.id)
    .orderBy(desc(clientAccounts.createdAt));

  return (
    <>
      <PageHeader
        title="Clients"
        subtitle={`${rows.length} client${rows.length === 1 ? "" : "s"}`}
        actions={<Link href="/clients/new" className="btn-primary">New client</Link>}
      />
      {rows.length === 0 ? (
        <EmptyState title="No clients yet" cta={{ href: "/clients/new", label: "Add your first client" }} />
      ) : (
        <div className="card overflow-hidden divide-y divide-hairline">
          {rows.map((c) => (
            <ListRow
              key={c.id}
              href={`/clients/${c.id}`}
              primary={c.name}
              secondary={[c.industry, c.primaryContactName].filter(Boolean).join(" · ") || "—"}
              trailing={<Badge tone="default">{c.jobCount} job{c.jobCount === 1 ? "" : "s"}</Badge>}
            />
          ))}
        </div>
      )}
    </>
  );
}
