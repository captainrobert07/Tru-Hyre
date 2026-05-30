import { desc } from "drizzle-orm";
import Link from "next/link";
import { db } from "@/db";
import { jobs, clientAccounts } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireStaff } from "@/lib/rbac";
import { PageHeader, ListRow, JobStatusBadge, EmptyState } from "@/components/primitives";

export const dynamic = "force-dynamic";

export default async function JobsPage() {
  await requireStaff();
  const rows = await db
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
    .orderBy(desc(jobs.createdAt));

  return (
    <>
      <PageHeader
        title="Jobs"
        subtitle={`${rows.length} job${rows.length === 1 ? "" : "s"}`}
        actions={<Link href="/jobs/new" className="btn-primary">New job</Link>}
      />
      {rows.length === 0 ? (
        <EmptyState title="No jobs yet" cta={{ href: "/jobs/new", label: "Create job" }} />
      ) : (
        <div className="card overflow-hidden divide-y divide-hairline">
          {rows.map((j) => (
            <ListRow
              key={j.id}
              href={`/jobs/${j.id}`}
              primary={j.title}
              secondary={[j.clientName, j.location, `${j.positions} position${j.positions === 1 ? "" : "s"}`].filter(Boolean).join(" · ")}
              trailing={<JobStatusBadge status={j.status} />}
            />
          ))}
        </div>
      )}
    </>
  );
}
