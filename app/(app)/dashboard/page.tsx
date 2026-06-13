import { count, eq, desc, sql, and, isNull, ne } from "drizzle-orm";
import Link from "next/link";
import { db } from "@/db";
import { candidates, jobs, submissions, notifications, vendorAccounts, clientAccounts, tasks } from "@/db/schema";
import { redirect } from "next/navigation";
import { requireStaffOrLite } from "@/lib/rbac";
import { isFeatureEnabled } from "@/lib/features";
import { PageHeader, StatCard, ListRow, StageBadge, EmptyState, Badge } from "@/components/primitives";
import { TasksCard } from "@/components/tasks-card";
import { OnboardingBanner } from "@/components/onboarding-banner";
import { FirstRunChecklist } from "@/components/first-run-checklist";
import { createTaskAction, completeTaskAction, snoozeTaskAction, deleteTaskAction } from "../tasks/actions";
import {
  getCoverageRatio,
  getOfferAcceptance,
  getRecruiterScoreboard,
  getSubmissionForecast,
} from "@/lib/metrics";

export const dynamic = "force-dynamic";
export const metadata = { title: "Dashboard" };

const FUNNEL_STEPS = ["received", "screening", "submitted", "shortlist", "interview", "offer", "joined"] as const;

export default async function DashboardPage() {
  const user = await requireStaffOrLite();
  // hr_lite has no org-wide dashboard — send them to their candidate workspace.
  if (user.role === "hr_lite") redirect("/candidates");
  const onboardingEnabled = await isFeatureEnabled("onboarding");

  const [
    candTotalRow,
    candThisWeekRow,
    candPrevWeekRow,
    openJobsRow,
    openJobsPrevRow,
    subsTotalRow,
    subsThisWeekRow,
    subsPrevWeekRow,
    offersThisWeekRow,
    offersPrevWeekRow,
    recentCandidates,
    weeklyVolume,
    awaitingFeedback,
    stuckCandidates,
    myUnread,
    funnelRows,
    vendorLeaderboard,
    jobAttention,
    avgTimeToSubmitRow,
    avgTimeToOfferRow,
    coverage,
    acceptance,
    forecast,
    scoreboard,
    myTasks,
  ] = await Promise.all([
    db.select({ n: count() }).from(candidates),
    db.select({ n: count() }).from(candidates).where(sql`${candidates.createdAt} >= now() - interval '7 days'`),
    db.select({ n: count() }).from(candidates).where(sql`${candidates.createdAt} >= now() - interval '14 days' AND ${candidates.createdAt} < now() - interval '7 days'`),
    db.select({ n: count() }).from(jobs).where(eq(jobs.status, "open")),
    db.select({ n: count() }).from(jobs).where(and(eq(jobs.status, "open"), sql`${jobs.createdAt} <= now() - interval '7 days'`)),
    db.select({ n: count() }).from(submissions),
    db.select({ n: count() }).from(submissions).where(sql`${submissions.createdAt} >= now() - interval '7 days'`),
    db.select({ n: count() }).from(submissions).where(sql`${submissions.createdAt} >= now() - interval '14 days' AND ${submissions.createdAt} < now() - interval '7 days'`),
    db.select({ n: count() }).from(submissions).where(and(sql`${submissions.status} in ('offer', 'joined')`, sql`${submissions.updatedAt} >= now() - interval '7 days'`)),
    db.select({ n: count() }).from(submissions).where(and(sql`${submissions.status} in ('offer', 'joined')`, sql`${submissions.updatedAt} >= now() - interval '14 days' AND ${submissions.updatedAt} < now() - interval '7 days'`)),
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
    // Funnel: count distinct candidates that *ever reached* each stage
    // (via either current stage or stage_history). Simpler approximation:
    // count by current stage and assume forward-only.
    db.execute(sql`
      SELECT stage, COUNT(*)::int AS n
      FROM ${candidates}
      GROUP BY stage
    `),
    // Vendor leaderboard: top 5 by submitted candidates in last 30 days
    // with shortlist+ rate.
    db.execute(sql`
      SELECT
        v.id, v.name,
        COUNT(DISTINCT s.id)::int AS submissions,
        COUNT(DISTINCT CASE WHEN s.status IN ('shortlist','interview','offer','joined') THEN s.id END)::int AS quality,
        COUNT(DISTINCT CASE WHEN s.status = 'reject' THEN s.id END)::int AS rejected
      FROM ${vendorAccounts} v
      LEFT JOIN ${candidates} c ON c.vendor_account_id = v.id
      LEFT JOIN ${submissions} s ON s.candidate_id = c.id AND s.created_at >= now() - interval '30 days'
      GROUP BY v.id, v.name
      HAVING COUNT(DISTINCT s.id) > 0
      ORDER BY quality DESC, submissions DESC
      LIMIT 5
    `),
    // Job attention: open jobs aging >30 days OR no submissions in 7 days
    db.execute(sql`
      SELECT
        j.id, j.title, j.created_at,
        c.name AS client_name,
        COUNT(DISTINCT s.id)::int AS sub_count,
        MAX(s.created_at) AS last_submission_at,
        EXTRACT(DAY FROM now() - j.created_at)::int AS age_days
      FROM ${jobs} j
      LEFT JOIN ${clientAccounts} c ON c.id = j.client_account_id
      LEFT JOIN ${submissions} s ON s.job_id = j.id
      WHERE j.status = 'open'
      GROUP BY j.id, j.title, j.created_at, c.name
      HAVING (
        EXTRACT(DAY FROM now() - j.created_at) > 30
        OR (MAX(s.created_at) IS NULL OR MAX(s.created_at) < now() - interval '7 days')
      )
      ORDER BY j.created_at ASC
      LIMIT 5
    `),
    // Average days from candidate.createdAt -> first submission (this candidate)
    db.execute(sql`
      SELECT COALESCE(AVG(EXTRACT(EPOCH FROM (s.created_at - c.created_at)) / 86400), 0)::numeric(10,1) AS avg_days
      FROM ${candidates} c
      JOIN LATERAL (
        SELECT created_at FROM ${submissions} s
        WHERE s.candidate_id = c.id
        ORDER BY s.created_at ASC LIMIT 1
      ) s ON true
      WHERE c.created_at >= now() - interval '90 days'
    `),
    // Average days from candidate.createdAt -> offer/joined submission
    db.execute(sql`
      SELECT COALESCE(AVG(EXTRACT(EPOCH FROM (s.updated_at - c.created_at)) / 86400), 0)::numeric(10,1) AS avg_days
      FROM ${candidates} c
      JOIN LATERAL (
        SELECT updated_at FROM ${submissions} s
        WHERE s.candidate_id = c.id AND s.status IN ('offer','joined')
        ORDER BY s.updated_at ASC LIMIT 1
      ) s ON true
      WHERE c.created_at >= now() - interval '180 days'
    `),
    getCoverageRatio(),
    getOfferAcceptance(365),
    getSubmissionForecast(),
    getRecruiterScoreboard(30),
    db
      .select()
      .from(tasks)
      .where(and(eq(tasks.ownerId, Number(user.id)), ne(tasks.status, "done")))
      .orderBy(tasks.dueAt, desc(tasks.createdAt))
      .limit(10),
  ]);

  const days = (weeklyVolume.rows || weeklyVolume) as Array<{ day: string; n: number }>;
  const max = Math.max(1, ...days.map((d) => d.n));

  const candTotal = candTotalRow[0]?.n ?? 0;
  const candThisWeek = candThisWeekRow[0]?.n ?? 0;
  const candPrevWeek = candPrevWeekRow[0]?.n ?? 0;
  const openJobsCount = openJobsRow[0]?.n ?? 0;
  const openJobsPrev = openJobsPrevRow[0]?.n ?? 0;
  const subsTotal = subsTotalRow[0]?.n ?? 0;
  const subsThisWeek = subsThisWeekRow[0]?.n ?? 0;
  const subsPrevWeek = subsPrevWeekRow[0]?.n ?? 0;
  const offersThisWeek = offersThisWeekRow[0]?.n ?? 0;
  const offersPrevWeek = offersPrevWeekRow[0]?.n ?? 0;
  const unread = myUnread[0]?.n ?? 0;

  // Funnel: rebuild as ordered counts.
  const funnelMap = new Map<string, number>();
  for (const r of (funnelRows.rows || funnelRows) as Array<{ stage: string; n: number }>) {
    funnelMap.set(r.stage, r.n);
  }
  // For funnel display, we use cumulative downstream counts (everyone past
  // submitted is counted toward submitted; everyone past shortlist counts
  // toward shortlist; etc.).
  const STAGE_ORDER = ["received", "hr_review", "screening", "submitted", "shortlist", "interview", "offer", "joined"];
  const stageCounts: Record<string, number> = {};
  STAGE_ORDER.forEach((s) => { stageCounts[s] = funnelMap.get(s) ?? 0; });
  const cumulative: Record<string, number> = {};
  let running = 0;
  for (let i = STAGE_ORDER.length - 1; i >= 0; i--) {
    const s = STAGE_ORDER[i];
    running += stageCounts[s];
    cumulative[s] = running;
  }

  const funnel = FUNNEL_STEPS.map((s, i) => {
    const count = cumulative[s] || 0;
    const prevCount = i === 0 ? count : cumulative[FUNNEL_STEPS[i - 1]] || 0;
    const passRate = prevCount > 0 ? Math.round((count / prevCount) * 100) : 0;
    return { stage: s, count, passRate };
  });
  const funnelMax = Math.max(1, ...funnel.map((f) => f.count));

  const vendorRows = (vendorLeaderboard.rows || vendorLeaderboard) as Array<{
    id: number; name: string; submissions: number; quality: number; rejected: number;
  }>;
  const maxVendorSubs = Math.max(1, ...vendorRows.map((v) => v.submissions));

  const jobsAttention = (jobAttention.rows || jobAttention) as Array<{
    id: number; title: string; client_name: string | null; sub_count: number;
    last_submission_at: Date | null; age_days: number;
  }>;

  const avgTimeToSubmit = Number((avgTimeToSubmitRow.rows || avgTimeToSubmitRow)[0]?.avg_days || 0);
  const avgTimeToOffer = Number((avgTimeToOfferRow.rows || avgTimeToOfferRow)[0]?.avg_days || 0);

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

      {onboardingEnabled && <OnboardingBanner firstName={(user.fullName || user.email).split(" ")[0]} />}

      {/* First-run guide while the workspace is still being set up. */}
      {(candTotal === 0 || openJobsCount === 0 || subsTotal === 0) && (
        <FirstRunChecklist jobs={openJobsCount} candidates={candTotal} submissions={subsTotal} />
      )}

      <MyDayBanner
        awaitingFeedback={awaitingFeedback}
        stuckCount={stuckCandidates.length}
        unread={unread}
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard
          label="Candidates"
          value={candTotal}
          tone="good"
          delta={{ value: candThisWeek - candPrevWeek, label: "vs last 7d" }}
        />
        <StatCard
          label="Open jobs"
          value={openJobsCount}
          delta={{ value: openJobsCount - openJobsPrev, label: "vs 7d ago" }}
        />
        <StatCard
          label="Submissions"
          value={subsTotal}
          delta={{ value: subsThisWeek - subsPrevWeek, label: "vs last 7d" }}
        />
        <StatCard
          label="Offers/joined"
          value={offersThisWeek}
          hint="last 7 days"
          tone="info"
          delta={{ value: offersThisWeek - offersPrevWeek, label: "vs last 7d" }}
        />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
        <DashStat
          label="Coverage ratio"
          value={coverage.ratio.toFixed(1)}
          hint={
            <>
              {coverage.activeCandidates}/{coverage.openPositions} active/positions
              {coverage.ratio < 1 && coverage.openPositions > 0 && (
                <Badge tone="red" className="ml-1.5 text-[10px]">starved</Badge>
              )}
            </>
          }
          tooltip="Active candidates ÷ open positions across all open jobs. >3 healthy, 1-3 tight, <1 starved."
        />
        <DashStat
          label="Offer acceptance"
          value={
            <>
              {acceptance.acceptanceRate}
              <span className="text-ink-muted text-2xl">%</span>
            </>
          }
          hint={`${acceptance.joins}/${acceptance.offers + acceptance.joins} joined (1y)`}
          tooltip="Of every offer that closed in the last year, what fraction joined?"
        />
        <DashStat
          label="Time to submit"
          value={avgTimeToSubmit > 0 ? avgTimeToSubmit.toFixed(1) : "—"}
          hint="days, last 90d"
          tooltip="Average days from candidate upload to first submission, last 90-day cohort."
        />
        <DashStat
          label="Time to offer"
          value={avgTimeToOffer > 0 ? avgTimeToOffer.toFixed(1) : "—"}
          hint="days, last 180d"
          tooltip="Average days from candidate upload to offer/joined, last 180-day cohort."
        />
        <DashStat
          label="Submit rate"
          value={
            <>
              {candTotal > 0 ? Math.round((subsTotal / candTotal) * 100) : 0}
              <span className="text-ink-muted text-2xl">%</span>
            </>
          }
          hint="cands → subs"
          tooltip="What % of all candidates ever became a submission to a job. Higher = better screening."
        />
        <DashStat
          label="Forecast"
          value={forecast.projectedThisMonth}
          hint={`subs this month at ${forecast.weeklyAvg}/wk`}
          tooltip="Projected submissions this calendar month, scaled from the trailing 4-week pace."
        />
      </div>

      <div className="card p-5 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold">Pipeline funnel</h2>
          <Link href="/reports" className="text-xs text-brand-700 hover:underline">Full reports →</Link>
        </div>
        <div className="space-y-2.5">
          {funnel.map((f, i) => {
            const widthPct = (f.count / funnelMax) * 100;
            const isFirst = i === 0;
            const tone =
              f.stage === "joined" || f.stage === "offer" ? "bg-brand-500"
              : f.stage === "shortlist" || f.stage === "interview" ? "bg-brand-400"
              : "bg-blue-400";
            return (
              <div key={f.stage} className="flex items-center gap-3 text-sm">
                <div className="w-24 md:w-28 text-xs uppercase tracking-wide text-ink-soft capitalize shrink-0">
                  {f.stage.replaceAll("_", " ")}
                </div>
                <div className="flex-1 bg-canvas rounded-full h-7 overflow-hidden relative">
                  <div
                    className={`h-full ${tone} rounded-full flex items-center justify-end pr-3 text-white text-xs font-semibold tabular-nums transition-all`}
                    style={{ width: `${Math.max(8, widthPct)}%` }}
                  >
                    {f.count}
                  </div>
                </div>
                {!isFirst && (
                  <div className="w-14 text-right text-xs text-ink-muted tabular-nums shrink-0">
                    {f.passRate}%
                  </div>
                )}
                {isFirst && <div className="w-14 shrink-0" />}
              </div>
            );
          })}
        </div>
        <p className="text-[11px] text-ink-muted mt-3">
          Each row counts candidates currently at or beyond that stage. Pass-through % is candidates that made it from the prior step.
        </p>
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
            <div className="stat-huge mt-3">{candTotal}</div>
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

      {scoreboard.length > 1 && (
        <section className="card p-5 mb-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold">Recruiter scoreboard</h2>
            <Link href="/reports" className="text-xs text-brand-700 hover:underline">Full breakdown →</Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {scoreboard.slice(0, 3).map((s, i) => (
              <div key={s.recruiterId} className={`p-4 rounded-xl2 border ${
                i === 0 ? "bg-brand-500 text-white border-brand-500"
                : i === 1 ? "bg-canvas border-hairline"
                : "bg-canvas border-hairline"
              }`}>
                <div className="flex items-center gap-2 mb-2">
                  <span className={`size-7 rounded-full text-xs font-bold flex items-center justify-center ${
                    i === 0 ? "bg-white/20 text-white" : "bg-ink_inverted text-white"
                  }`}>
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className={`text-sm font-semibold truncate ${i === 0 ? "" : "text-ink"}`}>
                      {s.fullName || s.email}
                    </div>
                  </div>
                </div>
                <div className={`text-2xl font-semibold tabular-nums ${i === 0 ? "" : "text-ink"}`}>
                  {s.joins}
                  <span className={`text-xs ml-1.5 ${i === 0 ? "opacity-70" : "text-ink-muted"}`}>joins</span>
                </div>
                <div className={`text-[11px] mt-1 ${i === 0 ? "opacity-80" : "text-ink-soft"}`}>
                  {s.uploads} uploads · {s.submitted} submitted · {s.offers} offers
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <div className="card overflow-hidden">
          <div className="px-5 py-4 border-b border-hairline flex items-center justify-between">
            <div className="text-sm font-semibold">Top vendors (30d)</div>
            <Link href="/vendors" className="text-xs text-brand-700 hover:underline">All vendors →</Link>
          </div>
          {vendorRows.length === 0 ? (
            <div className="px-5 py-12 text-center text-sm text-ink-muted">
              No vendor activity in the last 30 days.
            </div>
          ) : (
            <div className="p-5 space-y-3">
              {vendorRows.map((v) => {
                const qualityRate = v.submissions > 0 ? Math.round((v.quality / v.submissions) * 100) : 0;
                const widthPct = (v.submissions / maxVendorSubs) * 100;
                return (
                  <div key={v.id}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <Link href={`/vendors/${v.id}`} className="font-medium hover:text-brand-700 truncate">
                        {v.name}
                      </Link>
                      <span className="text-xs text-ink-muted tabular-nums">
                        {v.quality}/{v.submissions} <span className="text-brand-700 font-medium">({qualityRate}%)</span>
                      </span>
                    </div>
                    <div className="h-2 bg-canvas rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-brand-400 to-brand-600 rounded-full"
                        style={{ width: `${widthPct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="card overflow-hidden">
          <div className="px-5 py-4 border-b border-hairline flex items-center justify-between">
            <div className="text-sm font-semibold">Jobs needing attention</div>
            <Badge tone={jobsAttention.length > 0 ? "amber" : "default"}>
              {jobsAttention.length} flagged
            </Badge>
          </div>
          {jobsAttention.length === 0 ? (
            <div className="px-5 py-12 text-center text-sm text-ink-muted">
              All open jobs are healthy.
            </div>
          ) : (
            <div className="divide-y divide-hairline">
              {jobsAttention.map((j) => {
                const isStale = j.last_submission_at === null || (Date.now() - new Date(j.last_submission_at).getTime() > 7 * 24 * 60 * 60 * 1000);
                const isOld = j.age_days > 30;
                const tag = isOld && isStale ? "old + stale" : isOld ? `${j.age_days}d old` : "stale";
                return (
                  <Link
                    key={j.id}
                    href={`/jobs/${j.id}`}
                    className="px-5 py-3 flex items-center justify-between gap-3 hover:bg-canvas transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{j.title}</div>
                      <div className="text-xs text-ink-soft truncate">
                        {[j.client_name, `${j.sub_count} submission${j.sub_count === 1 ? "" : "s"}`].filter(Boolean).join(" · ")}
                      </div>
                    </div>
                    <Badge tone="amber">{tag}</Badge>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <TasksCard
          tasks={myTasks.map((t) => ({
            id: t.id,
            title: t.title,
            body: t.body,
            status: t.status,
            dueAt: t.dueAt ? t.dueAt.toISOString() : null,
            candidateId: t.candidateId,
            jobId: t.jobId,
          }))}
          onCreate={async (fd) => {
            "use server";
            await createTaskAction(fd);
          }}
          onComplete={async (id) => {
            "use server";
            await completeTaskAction(id);
          }}
          onSnooze={async (id, days) => {
            "use server";
            await snoozeTaskAction(id, days);
          }}
          onDelete={async (id) => {
            "use server";
            await deleteTaskAction(id);
          }}
        />

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

function DashStat({
  label,
  value,
  hint,
  tooltip,
}: {
  label: string;
  value: React.ReactNode;
  hint: React.ReactNode;
  tooltip: string;
}) {
  return (
    <div className="card p-5">
      <div className="text-xs text-ink-muted uppercase tracking-wide flex items-center gap-1.5">
        <span className="truncate">{label}</span>
        <DashTooltip text={tooltip} />
      </div>
      <div className="stat-big mt-2">{value}</div>
      <div className="text-xs text-ink-soft mt-1">{hint}</div>
    </div>
  );
}

function DashTooltip({ text }: { text: string }) {
  return (
    <span
      tabIndex={0}
      className="group relative inline-flex items-center justify-center size-4 rounded-full bg-canvas text-ink-muted text-[9px] font-bold cursor-help hover:bg-hairline hover:text-ink-soft focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-1 align-middle shrink-0"
      aria-label={text}
    >
      ?
      <span
        role="tooltip"
        className="invisible opacity-0 group-hover:visible group-hover:opacity-100 group-focus:visible group-focus:opacity-100 transition-opacity duration-150 absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2.5 py-1.5 rounded-lg bg-ink_inverted text-white text-[11px] font-normal leading-relaxed whitespace-normal w-56 shadow-pop pointer-events-none z-50"
      >
        {text}
        <span className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 size-2 rotate-45 bg-ink_inverted" />
      </span>
    </span>
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
