import { count, eq, desc, sql, and, isNull } from "drizzle-orm";
import Link from "next/link";
import { db } from "@/db";
import { candidates, jobs, submissions, notifications } from "@/db/schema";
import { requireStaff } from "@/lib/rbac";
import { PageHeader, StatCard, ListRow, StageBadge, EmptyState, Badge } from "@/components/primitives";

export const dynamic = "force-dynamic";
export const metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const user = await requireStaff();

  const [
    candCount,
    openJobs,
    recentSubs,
    submittedTodayRows,
    recentCandidates,
    weeklyVolume,
    awaitingFeedback,
    stuckCandidates,
    myUnread,
  ] = await Promise.all([
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
    db
      .select({
        id: submissions.id,
        candidateId: submissions.candidateId,
        jobId: submissions.jobId,
        candidateName: candidates.fullName,
        createdAt: submissions.createdAt,
      })
      .from(submissions)
      .innerJoin(candidates, eq(submissions.candidateId, candidates.id))
      .where(and(
        eq(submissions.status, "submitted"),
        sql`${submissions.createdAt} <= now() - interval '5 days'`,
      ))
      .orderBy(submissions.createdAt)
      .limit(5),
    db
      .select({
        id: candidates.id,
        fullName: candidates.fullName,
        stage: candidates.stage,
        updatedAt: candidates.updatedAt,
      })
      .from(candidates)
      .where(and(
        sql`${candidates.updatedAt} <= now() - interval '14 days'`,
        sql`${candidates.stage} not in ('joined', 'rejected', 'offer')`,
      ))
      .orderBy(candidates.updatedAt)
      .limit(5),
    db
      .select({ n: count() })
      .from(notifications)
      .where(and(eq(notifications.userId, Number(user.id)), isNull(notifications.readAt))),
  ]);

  const days = (weeklyVolume.rows || weeklyVolume) as Array<{ day: string; n: number }>;
  const max = Math.max(1, ...days.map((d) => d.n));

  return (
    <>
      <PageHeader
        title={`Hi, ${(user.fullName || user.email).split(" ")[0]}`}
        subtitle="Here's what needs you today."
        actions={
          <>
            <Link href="/candidates/upload" className="btn-ghost">Upload resume</Link>
            <Link href="/jobs/new" className="btn-primary">New job</Link>
          </>
        }
      />

      <MyDayBanner
        awaitingFeedback={awaitingFeedback}
        stuckCount={stuckCandidates.length}
        unread={myUnread[0]?.n ?? 0}
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
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

        <div className="card overflow-hidden">
          <div className="px-5 py-4 border-b border-hairline flex items-center justify-between">
            <div className="text-sm font-semibold">Stuck candidates</div>
            <Badge tone={stuckCandidates.length > 0 ? "amber" : "default"}>
              {stuckCandidates.length} idle
            </Badge>
          </div>
          {stuckCandidates.length === 0 ? (
            <div className="px-5 py-12 text-center text-sm text-ink-muted">
              Nothing stuck. Pipeline is moving.
            </div>
          ) : (
            <div className="divide-y divide-hairline">
              {stuckCandidates.map((c) => (
                <ListRow
                  key={c.id}
                  href={`/candidates/${c.id}`}
                  primary={c.fullName}
                  secondary={`Hasn't moved since ${new Date(c.updatedAt).toLocaleDateString()}`}
                  trailing={<StageBadge stage={c.stage} />}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function MyDayBanner({
  awaitingFeedback,
  stuckCount,
  unread,
}: {
  awaitingFeedback: { id: number; candidateId: number; jobId: number; candidateName: string; createdAt: Date }[];
  stuckCount: number;
  unread: number;
}) {
  const total = awaitingFeedback.length + stuckCount + unread;
  if (total === 0) {
    return (
      <div className="card p-5 mb-6 bg-brand-50 border-brand-100 flex items-center gap-3">
        <span className="text-2xl">🎉</span>
        <div>
          <div className="text-sm font-semibold text-brand-900">All clear</div>
          <div className="text-xs text-brand-700">No stuck candidates, no overdue feedback. Nice work.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="card p-5 mb-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <span className="size-2 rounded-full bg-attention-500 animate-pulse" />
          Your day
        </h2>
        <span className="text-xs text-ink-muted">{total} item{total === 1 ? "" : "s"} need attention</span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <DayCard
          label="Overdue feedback"
          value={awaitingFeedback.length}
          hint="submissions waiting >5 days"
          href="/submissions?status=submitted"
          tone="attention"
        />
        <DayCard
          label="Stuck candidates"
          value={stuckCount}
          hint="no movement in 14 days"
          href="/candidates"
          tone="amber"
        />
        <DayCard
          label="Unread notifications"
          value={unread}
          hint="@mentions, feedback events"
          href="/notifications"
          tone="info"
        />
      </div>
    </div>
  );
}

function DayCard({
  label, value, hint, href, tone,
}: {
  label: string;
  value: number;
  hint: string;
  href: string;
  tone: "attention" | "amber" | "info";
}) {
  const accent =
    tone === "attention" ? "bg-attention-50 text-attention-700 border-attention-100"
    : tone === "amber" ? "bg-amber-50 text-amber-700 border-amber-100"
    : "bg-blue-50 text-blue-700 border-blue-100";
  return (
    <Link href={href} className={`block p-4 rounded-xl2 border ${accent} hover:opacity-90 transition-opacity`}>
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-wide opacity-80">{label}</span>
        <span className="text-2xl font-semibold tabular-nums">{value}</span>
      </div>
      <div className="text-xs opacity-80 mt-1">{hint}</div>
    </Link>
  );
}
