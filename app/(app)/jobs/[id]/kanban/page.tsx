import Link from "next/link";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { jobs, submissions, candidates, clientAccounts } from "@/db/schema";
import { requireStaff } from "@/lib/rbac";
import { PageHeader, Badge } from "@/components/primitives";

export const dynamic = "force-dynamic";
export const metadata = { title: "Job pipeline" };

const COLUMNS = [
  { status: "submitted", label: "Submitted", tone: "blue" as const },
  { status: "shortlist", label: "Shortlist", tone: "green" as const },
  { status: "interview", label: "Interview", tone: "amber" as const },
  { status: "hold", label: "Hold", tone: "amber" as const },
  { status: "offer", label: "Offer", tone: "green" as const },
  { status: "joined", label: "Joined", tone: "green" as const },
  { status: "reject", label: "Rejected", tone: "red" as const },
];

export default async function JobKanban({ params }: { params: Promise<{ id: string }> }) {
  await requireStaff();
  const { id } = await params;
  const jobId = Number(id);
  if (!Number.isFinite(jobId)) notFound();

  const j = (
    await db
      .select({ id: jobs.id, title: jobs.title, clientName: clientAccounts.name })
      .from(jobs)
      .leftJoin(clientAccounts, eq(jobs.clientAccountId, clientAccounts.id))
      .where(eq(jobs.id, jobId))
  )[0];
  if (!j) notFound();

  const subs = await db
    .select({
      id: submissions.id,
      candidateId: submissions.candidateId,
      candidateName: candidates.fullName,
      candidateRefId: candidates.refId,
      candidateTitle: candidates.currentTitle,
      candidateExperience: candidates.experienceYears,
      starred: candidates.starredByClient,
      status: submissions.status,
      createdAt: submissions.createdAt,
    })
    .from(submissions)
    .innerJoin(candidates, eq(submissions.candidateId, candidates.id))
    .where(eq(submissions.jobId, jobId))
    .orderBy(submissions.createdAt);

  const grouped = new Map<string, typeof subs>();
  for (const col of COLUMNS) grouped.set(col.status, []);
  for (const s of subs) {
    if (grouped.has(s.status)) grouped.get(s.status)!.push(s);
  }

  return (
    <>
      <PageHeader
        title={j.title}
        subtitle={`${j.clientName} · ${subs.length} submissions`}
        actions={
          <>
            <Link href={`/jobs/${jobId}`} className="btn-ghost">Back to job</Link>
          </>
        }
      />

      <div className="grid grid-flow-col auto-cols-[minmax(260px,1fr)] gap-3 overflow-x-auto pb-4">
        {COLUMNS.map((col) => {
          const cards = grouped.get(col.status) || [];
          return (
            <div key={col.status} className="flex flex-col bg-canvas border border-hairline rounded-xl2 min-h-[400px]">
              <div className="px-3 py-2.5 border-b border-hairline flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wide">{col.label}</span>
                <Badge tone={col.tone}>{cards.length}</Badge>
              </div>
              <div className="p-2 space-y-2 flex-1 overflow-y-auto">
                {cards.length === 0 ? (
                  <div className="text-[11px] text-ink-muted text-center py-8">Empty</div>
                ) : (
                  cards.map((c) => (
                    <Link
                      key={c.id}
                      href={`/candidates/${c.candidateId}`}
                      className="block bg-surface rounded-lg shadow-card p-3 hover:shadow-pop transition-shadow"
                    >
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <div className="text-sm font-medium leading-tight line-clamp-2">
                          {c.starred && <span className="text-amber-500 mr-1" aria-label="starred">★</span>}
                          {c.candidateName}
                        </div>
                      </div>
                      <div className="text-[10px] font-mono text-ink-muted mb-1.5">{c.candidateRefId}</div>
                      <div className="text-xs text-ink-soft line-clamp-1">{c.candidateTitle || "—"}</div>
                      <div className="text-[10px] text-ink-muted mt-1">
                        {c.candidateExperience ? `${c.candidateExperience} yrs · ` : ""}
                        {new Date(c.createdAt).toLocaleDateString()}
                      </div>
                    </Link>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-[11px] text-ink-muted text-center pt-2">
        Drag-and-drop coming soon. For now, click a card to open the candidate and move stages from there.
      </p>
    </>
  );
}
