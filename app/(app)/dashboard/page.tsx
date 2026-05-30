import { count, eq, desc, sql } from "drizzle-orm";
import Link from "next/link";
import { db } from "@/db";
import { candidates, jobs, submissions } from "@/db/schema";
import { PageHeader, StatCard, ListRow, StageBadge, EmptyState } from "@/components/primitives";

export const dynamic = "force-dynamic";
export const metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const [candCount, openJobs, recentSubs, submittedTodayRows, recentCandidates, weeklyVolume] = await Promise.all([
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
    db.execute(sql`
      SELECT to_char(date_trunc('day', created_at), 'Dy') AS day, COUNT(*)::int AS n
      FROM ${candidates}
      WHERE created_at >= now() - interval '7 days'
      GROUP BY date_trunc('day', created_at)
      ORDER BY date_trunc('day', created_at) ASC
    `),
  ]);

  const days = ((weeklyVolume.rows || weeklyVolume) as Array<{ day: string; n: number }>);
  const max = Math.max(1, ...days.map((d) => d.n));

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

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard label="Candidates" value={candCount[0]?.n ?? 0} tone="good" />
        <StatCard label="Open jobs" value={openJobs[0]?.n ?? 0} />
        <StatCard label="Submissions" value={recentSubs[0]?.n ?? 0} />
        <StatCard label="Last 7 days" value={submittedTodayRows[0]?.n ?? 0} hint="new submissions" tone="info" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        <div className="card p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold">Resume volume</h2>
            <span className="text-xs text-ink-muted">Last 7 days</span>
          </div>
          {days.length === 0 ? (
            <div className="text-sm text-ink-muted py-6 text-center">No uploads yet this week.</div>
          ) : (
            <div className="flex items-end gap-3 h-40 w-full">
              {days.map((d) => (
                <div key={d.day} className="flex-1 flex flex-col items-center gap-2">
                  <div
                    className="w-full bg-gradient-to-b from-brand-400 to-brand-700 rounded-md min-h-[4px]"
                    style={{ height: `${(d.n / max) * 100}%` }}
                    title={`${d.day}: ${d.n}`}
                  />
                  <span className="text-[10px] text-ink-muted">{d.day}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card p-5 bg-brand-500 text-white border-brand-500 relative overflow-hidden">
          <div className="absolute -top-10 -right-10 size-40 rounded-full bg-brand-400/40 blur-2xl" />
          <div className="relative">
            <div className="text-xs uppercase tracking-wide opacity-80">Pipeline health</div>
            <div className="stat-huge mt-3">{candCount[0]?.n ?? 0}</div>
            <div className="text-sm opacity-90 mt-2">candidates in flight</div>
            <Link
              href="/candidates"
              className="inline-flex items-center gap-1 mt-6 text-sm font-medium bg-white/15 hover:bg-white/25 px-4 h-9 rounded-full transition-colors"
            >
              Open pipeline →
            </Link>
          </div>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-hairline flex items-center justify-between">
          <div className="text-sm font-semibold">Recent candidates</div>
          <Link href="/candidates" className="text-xs text-brand-700 hover:underline">View all →</Link>
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
                secondary={[c.currentTitle, c.location].filter(Boolean).join(" · ") || undefined}
                trailing={<StageBadge stage={c.stage} />}
              />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
