import { desc, eq, and, type SQL } from "drizzle-orm";
import Link from "next/link";
import { db } from "@/db";
import { submissions, candidates, jobs, clientAccounts } from "@/db/schema";
import { requireStaff } from "@/lib/rbac";
import { PageHeader, Badge, EmptyState } from "@/components/primitives";

export const dynamic = "force-dynamic";
export const metadata = { title: "Submissions" };

const STATUS_TABS = ["all", "submitted", "shortlist", "interview", "hold", "offer", "joined", "reject"] as const;
type StatusTab = (typeof STATUS_TABS)[number];

export default async function SubmissionsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  await requireStaff();
  const { status } = await searchParams;
  const active: StatusTab = STATUS_TABS.includes(status as StatusTab) ? (status as StatusTab) : "all";

  const conditions: SQL[] = [];
  if (active !== "all") {
    conditions.push(eq(submissions.status, active));
  }

  const rows = await db
    .select({
      id: submissions.id,
      candidateId: submissions.candidateId,
      candidateName: candidates.fullName,
      candidateRefId: candidates.refId,
      jobId: submissions.jobId,
      jobTitle: jobs.title,
      clientName: clientAccounts.name,
      status: submissions.status,
      notes: submissions.notes,
      createdAt: submissions.createdAt,
    })
    .from(submissions)
    .innerJoin(candidates, eq(submissions.candidateId, candidates.id))
    .innerJoin(jobs, eq(submissions.jobId, jobs.id))
    .innerJoin(clientAccounts, eq(jobs.clientAccountId, clientAccounts.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(submissions.createdAt))
    .limit(300);

  return (
    <>
      <PageHeader title="Submissions" subtitle={`${rows.length} on this view`} />

      <div className="card mb-4 px-2 py-1.5 inline-flex flex-wrap gap-0.5">
        {STATUS_TABS.map((t) => (
          <Link
            key={t}
            href={t === "all" ? "/submissions" : `/submissions?status=${t}`}
            className={`text-xs px-3 h-8 rounded-md inline-flex items-center transition-colors ${
              active === t ? "bg-canvas text-ink shadow-card font-medium" : "text-ink-soft hover:text-ink"
            }`}
          >
            {t}
          </Link>
        ))}
      </div>

      {rows.length === 0 ? (
        <EmptyState
          title={active === "all" ? "No submissions yet" : `No "${active}" submissions`}
          description={active === "all" ? "Generate a packet on a candidate, then submit them to a job." : undefined}
        />
      ) : (
        <div className="card overflow-hidden divide-y divide-hairline">
          {rows.map((s) => (
            <div key={s.id} className="grid grid-cols-12 items-center gap-3 px-4 py-3 hover:bg-canvas transition-colors text-sm">
              <Link href={`/candidates/${s.candidateId}`} className="col-span-12 md:col-span-4 min-w-0 group">
                <div className="font-medium truncate group-hover:text-brand-700">{s.candidateName}</div>
                <div className="text-[10px] text-ink-muted font-mono">{s.candidateRefId}</div>
              </Link>
              <div className="col-span-12 md:col-span-5 min-w-0 text-ink-soft text-xs">
                <div className="truncate">
                  <span className="text-ink-muted">→ </span>
                  <Link href={`/jobs/${s.jobId}`} className="hover:underline hover:text-brand-700">{s.jobTitle}</Link>
                </div>
                <div className="truncate text-ink-muted">{s.clientName}</div>
                {s.notes && <div className="truncate text-ink-muted italic" title={s.notes}>“{s.notes}”</div>}
              </div>
              <div className="col-span-7 md:col-span-2 text-xs text-ink-muted">{new Date(s.createdAt).toLocaleDateString()}</div>
              <div className="col-span-5 md:col-span-1 flex justify-end">
                <Badge tone={toneFor(s.status)}>{s.status}</Badge>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function toneFor(status: string): "blue" | "green" | "amber" | "red" | "default" {
  if (status === "shortlist" || status === "offer" || status === "joined") return "green";
  if (status === "interview" || status === "hold") return "amber";
  if (status === "reject") return "red";
  if (status === "submitted") return "blue";
  return "default";
}
