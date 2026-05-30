import { desc } from "drizzle-orm";
import { eq } from "drizzle-orm";
import Link from "next/link";
import { db } from "@/db";
import { submissions, candidates, jobs } from "@/db/schema";
import { requireStaff } from "@/lib/rbac";
import { PageHeader, ListRow, Badge, EmptyState } from "@/components/primitives";

export const dynamic = "force-dynamic";

export default async function SubmissionsPage() {
  await requireStaff();
  const rows = await db
    .select({
      id: submissions.id,
      candidateId: submissions.candidateId,
      candidateName: candidates.fullName,
      jobId: submissions.jobId,
      jobTitle: jobs.title,
      status: submissions.status,
      createdAt: submissions.createdAt,
    })
    .from(submissions)
    .innerJoin(candidates, eq(submissions.candidateId, candidates.id))
    .innerJoin(jobs, eq(submissions.jobId, jobs.id))
    .orderBy(desc(submissions.createdAt))
    .limit(200);

  return (
    <>
      <PageHeader title="Submissions" subtitle={`${rows.length} submission${rows.length === 1 ? "" : "s"}`} />
      {rows.length === 0 ? (
        <EmptyState title="No submissions yet" description="Generate a packet on a candidate, then submit them to a job." />
      ) : (
        <div className="card overflow-hidden divide-y divide-hairline">
          {rows.map((s) => (
            <ListRow
              key={s.id}
              href={`/candidates/${s.candidateId}`}
              primary={
                <span className="flex items-center gap-2">
                  <span>{s.candidateName}</span>
                  <span className="text-ink-muted">→</span>
                  <Link href={`/jobs/${s.jobId}`} onClick={(e) => e.stopPropagation()} className="text-brand-700 hover:underline">
                    {s.jobTitle}
                  </Link>
                </span>
              }
              secondary={new Date(s.createdAt).toLocaleString()}
              trailing={<Badge tone="blue">{s.status}</Badge>}
            />
          ))}
        </div>
      )}
    </>
  );
}
