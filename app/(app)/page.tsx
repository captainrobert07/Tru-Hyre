import { count, eq, desc, sql } from "drizzle-orm";
import Link from "next/link";
import { db } from "@/db";
import { candidates, jobs, submissions } from "@/db/schema";
import { PageHeader, StatCard, ListRow, StageBadge, EmptyState } from "@/components/primitives";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [candCount, openJobs, recentSubs, submittedTodayRows, recentCandidates] = await Promise.all([
    db.select({ n: count() }).from(candidates),
    db.select({ n: count() }).from(jobs).where(eq(jobs.status, "open")),
    db.select({ n: count() }).from(submissions),
    db
      .select({ n: count() })
      .from(submissions)
      .where(sql`${submissions.createdAt} >= now() - interval '7 days'`),
    db
      .select({
        id: candidates.id,
        fullName: candidates.fullName,
        currentTitle: candidates.currentTitle,
        location: candidates.location,
        stage: candidates.stage,
        createdAt: candidates.createdAt,
      })
      .from(candidates)
      .orderBy(desc(candidates.createdAt))
      .limit(6),
  ]);

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle="Pipeline at a glance"
        actions={
          <>
            <Link href="/candidates/upload" className="btn-ghost">Upload resume</Link>
            <Link href="/jobs/new" className="btn-primary">New job</Link>
          </>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <StatCard label="Candidates" value={candCount[0]?.n ?? 0} />
        <StatCard label="Open jobs" value={openJobs[0]?.n ?? 0} />
        <StatCard label="Submissions" value={recentSubs[0]?.n ?? 0} />
        <StatCard label="Last 7 days" value={submittedTodayRows[0]?.n ?? 0} hint="new submissions" />
      </div>

      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-hairline flex items-center justify-between">
          <div className="text-sm font-semibold">Recent candidates</div>
          <Link href="/candidates" className="text-xs text-brand-700 hover:underline">View all</Link>
        </div>
        {recentCandidates.length === 0 ? (
          <EmptyState
            title="No candidates yet"
            description="Upload your first resume to get started."
            cta={{ href: "/candidates/upload", label: "Upload resume" }}
          />
        ) : (
          <div className="divide-y divide-hairline">
            {recentCandidates.map((c) => (
              <ListRow
                key={c.id}
                href={`/candidates/${c.id}`}
                primary={c.fullName}
                secondary={[c.currentTitle, c.location].filter(Boolean).join(" · ")}
                trailing={<StageBadge stage={c.stage} />}
              />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
