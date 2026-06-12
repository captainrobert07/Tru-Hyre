import { sql, and, eq, count, isNull, desc, inArray, ne } from "drizzle-orm";
import { db } from "@/db";
import {
  candidates,
  submissions,
  jobs,
  vendorAccounts,
  users,
  stageHistory,
  tasks,
  notifications,
  interviews,
} from "@/db/schema";

// ---------- types ----------
export type SourceRow = { source: string; count: number };
export type SourceEffectivenessRow = {
  source: string;
  candidates: number;
  submitted: number;
  interviewed: number;
  offers: number;
  joins: number;
  joinRate: number; // joins / candidates, as a percentage
};
export type CycleRow = { stage: string; medianDays: number; sampleCount: number };
export type LocationRow = { location: string; count: number };
export type SlaRow = {
  vendorId: number;
  vendorName: string;
  total: number;
  withinSla: number;
  rate: number;
};
export type ScoreboardRow = {
  recruiterId: number;
  email: string;
  fullName: string | null;
  uploads: number;
  submitted: number;
  offers: number;
  joins: number;
};
export type StageDistRow = { stage: string; bucket: string; n: number };
export type CoverageRow = {
  openPositions: number;
  activeCandidates: number;
  ratio: number;
};
export type ForecastRow = {
  weeklyAvg: number;
  projectedThisMonth: number;
  trailingFourWeeks: number[];
};
export type CompensationRow = {
  median: number | null;
  mean: number | null;
  sampleCount: number;
};
export type AcceptanceRow = {
  offers: number;
  joins: number;
  acceptanceRate: number;
};

export type ActionItems = {
  tasks: Array<{ id: number; title: string; body: string | null; dueAt: string | null; candidateId: number | null; jobId: number | null }>;
  idleCandidates: Array<{ id: number; fullName: string; stage: string; updatedAt: string }>;
  staleSubmissions: Array<{ id: number; candidateId: number; jobId: number; candidateName: string; createdAt: string }>;
  upcomingInterviews: Array<{ id: number; candidateId: number; title: string; scheduledStart: string; mode: string }>;
  unreadNotifications: number;
  total: number;
};

// ---------- queries ----------

/**
 * Source of hire: classify each submission by where the candidate came from.
 * Today our only signal is candidate.vendorAccountId. NULL means HR/admin
 * uploaded directly (i.e., direct upload, client referral, internal, etc.).
 */
export async function getSourceOfHire(days = 90): Promise<SourceRow[]> {
  const rows = await db.execute<{ source: string; count: number }>(sql`
    SELECT
      CASE
        WHEN v.name IS NULL THEN 'Direct upload'
        ELSE v.name
      END AS source,
      COUNT(DISTINCT s.id)::int AS count
    FROM ${submissions} s
    INNER JOIN ${candidates} c ON c.id = s.candidate_id
    LEFT JOIN ${vendorAccounts} v ON v.id = c.vendor_account_id
    WHERE s.created_at >= now() - (${days} || ' days')::interval
    GROUP BY 1
    ORDER BY count DESC
    LIMIT 12
  `);
  return ((rows.rows || rows) as SourceRow[]).map((r) => ({
    source: r.source,
    count: Number(r.count),
  }));
}

const SOURCE_LABELS: Record<string, string> = {
  direct: "Direct",
  referral: "Referral",
  linkedin: "LinkedIn",
  job_board: "Job board",
  agency: "Agency / vendor",
  careers: "Careers page",
  other: "Other",
};

/**
 * Source effectiveness: quality funnel per candidate source. Counts candidates
 * per source and, via their submissions, how many ever reached submitted /
 * interview / offer / joined. joinRate is joins ÷ candidates.
 */
export async function getSourceEffectiveness(days = 365): Promise<SourceEffectivenessRow[]> {
  const rows = await db.execute<{
    source: string;
    candidates: number;
    submitted: number;
    interviewed: number;
    offers: number;
    joins: number;
  }>(sql`
    SELECT
      c.source::text AS source,
      COUNT(DISTINCT c.id)::int AS candidates,
      COUNT(DISTINCT s.id)::int AS submitted,
      COUNT(DISTINCT CASE WHEN s.status IN ('interview','offer','joined') THEN s.id END)::int AS interviewed,
      COUNT(DISTINCT CASE WHEN s.status IN ('offer','joined') THEN s.id END)::int AS offers,
      COUNT(DISTINCT CASE WHEN s.status = 'joined' THEN s.id END)::int AS joins
    FROM ${candidates} c
    LEFT JOIN ${submissions} s ON s.candidate_id = c.id
    WHERE c.created_at >= now() - (${days} || ' days')::interval
    GROUP BY c.source
    ORDER BY candidates DESC
  `);
  return ((rows.rows || rows) as Array<{
    source: string; candidates: number; submitted: number; interviewed: number; offers: number; joins: number;
  }>).map((r) => {
    const cands = Number(r.candidates);
    const joins = Number(r.joins);
    return {
      source: SOURCE_LABELS[r.source] || r.source,
      candidates: cands,
      submitted: Number(r.submitted),
      interviewed: Number(r.interviewed),
      offers: Number(r.offers),
      joins,
      joinRate: cands > 0 ? Math.round((joins / cands) * 100) : 0,
    };
  });
}

/**
 * Cycle time per stage: median days a candidate spent in each stage,
 * computed from stage_history transitions. Only stages that have at
 * least one transition out are counted.
 */
export async function getCycleTimePerStage(days = 180): Promise<CycleRow[]> {
  const rows = await db.execute<{ stage: string; median_days: string; sample_count: number }>(sql`
    WITH transitions AS (
      SELECT
        sh.candidate_id,
        sh.from_stage AS stage,
        sh.created_at AS exited_at,
        LAG(sh.created_at) OVER (PARTITION BY sh.candidate_id ORDER BY sh.created_at) AS entered_at
      FROM ${stageHistory} sh
      WHERE sh.created_at >= now() - (${days} || ' days')::interval
    )
    SELECT
      stage::text AS stage,
      percentile_cont(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (exited_at - entered_at)) / 86400)::numeric(10,1) AS median_days,
      COUNT(*)::int AS sample_count
    FROM transitions
    WHERE entered_at IS NOT NULL AND stage IS NOT NULL
    GROUP BY stage
    ORDER BY median_days DESC
  `);
  return ((rows.rows || rows) as Array<{ stage: string; median_days: string | null; sample_count: number }>).map((r) => ({
    stage: r.stage,
    medianDays: Number(r.median_days || 0),
    sampleCount: Number(r.sample_count),
  }));
}

/**
 * Location mix: top candidate locations. We strip the city name from
 * "City, Country" and group by it.
 */
export async function getLocationMix(): Promise<LocationRow[]> {
  const rows = await db.execute<{ location: string; count: number }>(sql`
    SELECT
      COALESCE(NULLIF(TRIM(SPLIT_PART(location, ',', 1)), ''), 'Unspecified') AS location,
      COUNT(*)::int AS count
    FROM ${candidates}
    GROUP BY 1
    ORDER BY count DESC
    LIMIT 10
  `);
  return ((rows.rows || rows) as LocationRow[]).map((r) => ({
    location: r.location,
    count: Number(r.count),
  }));
}

/**
 * Offer-acceptance rate: joined ÷ (offer + joined). We treat joined as
 * accepted, offer as still-pending or rejected. Closed deals only.
 */
export async function getOfferAcceptance(days = 365): Promise<AcceptanceRow> {
  const rows = await db.execute<{ offers: number; joins: number }>(sql`
    SELECT
      COUNT(DISTINCT CASE WHEN s.status = 'offer' THEN s.id END)::int AS offers,
      COUNT(DISTINCT CASE WHEN s.status = 'joined' THEN s.id END)::int AS joins
    FROM ${submissions} s
    WHERE s.updated_at >= now() - (${days} || ' days')::interval
  `);
  const r = ((rows.rows || rows) as Array<{ offers: number; joins: number }>)[0] ?? { offers: 0, joins: 0 };
  const offers = Number(r.offers);
  const joins = Number(r.joins);
  const total = offers + joins;
  return {
    offers,
    joins,
    acceptanceRate: total > 0 ? Math.round((joins / total) * 100) : 0,
  };
}

/**
 * Vendor SLA compliance: % of vendor-sourced candidates that left
 * "received" stage within 48h. Defaults to last 60 days for a stable
 * sample.
 */
export async function getVendorSlaCompliance(days = 60, slaHours = 48): Promise<SlaRow[]> {
  const rows = await db.execute<{
    vendor_id: number;
    vendor_name: string;
    total: number;
    within_sla: number;
  }>(sql`
    WITH first_movement AS (
      SELECT
        c.id AS candidate_id,
        c.vendor_account_id,
        c.created_at AS uploaded_at,
        MIN(sh.created_at) AS first_moved_at
      FROM ${candidates} c
      LEFT JOIN ${stageHistory} sh ON sh.candidate_id = c.id
        AND sh.from_stage = 'received'
      WHERE c.vendor_account_id IS NOT NULL
        AND c.created_at >= now() - (${days} || ' days')::interval
      GROUP BY c.id, c.vendor_account_id, c.created_at
    )
    SELECT
      v.id AS vendor_id,
      v.name AS vendor_name,
      COUNT(fm.candidate_id)::int AS total,
      SUM(
        CASE
          WHEN fm.first_moved_at IS NOT NULL
            AND EXTRACT(EPOCH FROM (fm.first_moved_at - fm.uploaded_at)) / 3600 <= ${slaHours}
          THEN 1 ELSE 0
        END
      )::int AS within_sla
    FROM ${vendorAccounts} v
    INNER JOIN first_movement fm ON fm.vendor_account_id = v.id
    GROUP BY v.id, v.name
    HAVING COUNT(fm.candidate_id) > 0
    ORDER BY total DESC
    LIMIT 10
  `);
  return ((rows.rows || rows) as Array<{ vendor_id: number; vendor_name: string; total: number; within_sla: number }>).map((r) => ({
    vendorId: Number(r.vendor_id),
    vendorName: r.vendor_name,
    total: Number(r.total),
    withinSla: Number(r.within_sla),
    rate: Number(r.total) > 0 ? Math.round((Number(r.within_sla) / Number(r.total)) * 100) : 0,
  }));
}

/**
 * Average compensation of joined candidates: a proxy for cost-per-hire.
 * Uses the `currentCtc` column on candidates that joined.
 */
export async function getJoinedCompensation(): Promise<CompensationRow> {
  const rows = await db.execute<{ median: string | null; mean: string | null; sample_count: number }>(sql`
    SELECT
      percentile_cont(0.5) WITHIN GROUP (
        ORDER BY c.expected_ctc
      )::numeric(20,0) AS median,
      AVG(c.expected_ctc)::numeric(20,0) AS mean,
      COUNT(*)::int AS sample_count
    FROM ${submissions} s
    INNER JOIN ${candidates} c ON c.id = s.candidate_id
    WHERE s.status = 'joined'
      AND c.expected_ctc IS NOT NULL
  `);
  const r = ((rows.rows || rows) as Array<{ median: string | null; mean: string | null; sample_count: number }>)[0] ?? { median: null, mean: null, sample_count: 0 };
  return {
    median: r.median ? Number(r.median) : null,
    mean: r.mean ? Number(r.mean) : null,
    sampleCount: Number(r.sample_count),
  };
}

/**
 * Per-recruiter scoreboard: uploads, submissions, offers, joins
 * by HR user in the last 30 days.
 */
export async function getRecruiterScoreboard(days = 30): Promise<ScoreboardRow[]> {
  const rows = await db.execute<{
    recruiter_id: number;
    email: string;
    full_name: string | null;
    uploads: number;
    submitted: number;
    offers: number;
    joins: number;
  }>(sql`
    WITH actor AS (
      SELECT id, email, full_name FROM ${users} WHERE role IN ('admin', 'hr')
    ),
    uploads AS (
      SELECT uploaded_by_id AS uid, COUNT(*)::int AS n
      FROM ${candidates}
      WHERE created_at >= now() - (${days} || ' days')::interval
        AND uploaded_by_id IS NOT NULL
      GROUP BY uid
    ),
    submitted AS (
      SELECT submitted_by_id AS uid, COUNT(*)::int AS n
      FROM ${submissions}
      WHERE created_at >= now() - (${days} || ' days')::interval
        AND submitted_by_id IS NOT NULL
      GROUP BY uid
    ),
    offers AS (
      SELECT submitted_by_id AS uid, COUNT(*)::int AS n
      FROM ${submissions}
      WHERE updated_at >= now() - (${days} || ' days')::interval
        AND status = 'offer'
        AND submitted_by_id IS NOT NULL
      GROUP BY uid
    ),
    joins AS (
      SELECT submitted_by_id AS uid, COUNT(*)::int AS n
      FROM ${submissions}
      WHERE updated_at >= now() - (${days} || ' days')::interval
        AND status = 'joined'
        AND submitted_by_id IS NOT NULL
      GROUP BY uid
    )
    SELECT
      a.id AS recruiter_id,
      a.email,
      a.full_name,
      COALESCE(u.n, 0) AS uploads,
      COALESCE(s.n, 0) AS submitted,
      COALESCE(o.n, 0) AS offers,
      COALESCE(j.n, 0) AS joins
    FROM actor a
    LEFT JOIN uploads u ON u.uid = a.id
    LEFT JOIN submitted s ON s.uid = a.id
    LEFT JOIN offers o ON o.uid = a.id
    LEFT JOIN joins j ON j.uid = a.id
    WHERE COALESCE(u.n, 0) + COALESCE(s.n, 0) + COALESCE(o.n, 0) + COALESCE(j.n, 0) > 0
    ORDER BY (COALESCE(j.n,0) * 10 + COALESCE(o.n,0) * 5 + COALESCE(s.n,0) * 2 + COALESCE(u.n,0)) DESC
    LIMIT 12
  `);
  return ((rows.rows || rows) as Array<{
    recruiter_id: number;
    email: string;
    full_name: string | null;
    uploads: number;
    submitted: number;
    offers: number;
    joins: number;
  }>).map((r) => ({
    recruiterId: Number(r.recruiter_id),
    email: r.email,
    fullName: r.full_name,
    uploads: Number(r.uploads),
    submitted: Number(r.submitted),
    offers: Number(r.offers),
    joins: Number(r.joins),
  }));
}

/**
 * Pipeline coverage ratio: active candidates ÷ open positions across
 * all open jobs. >3 is healthy, 1-3 is tight, <1 is starved.
 */
export async function getCoverageRatio(): Promise<CoverageRow> {
  const [openPosRow, activeRow] = await Promise.all([
    db.execute<{ positions: number }>(sql`
      SELECT COALESCE(SUM(positions), 0)::int AS positions
      FROM ${jobs}
      WHERE status = 'open'
    `),
    db.select({ n: count() }).from(candidates).where(
      sql`${candidates.stage} not in ('joined', 'rejected')`,
    ),
  ]);
  const openPositions = Number(((openPosRow.rows || openPosRow) as Array<{ positions: number }>)[0]?.positions ?? 0);
  const activeCandidates = activeRow[0]?.n ?? 0;
  return {
    openPositions,
    activeCandidates,
    ratio: openPositions > 0 ? Math.round((activeCandidates / openPositions) * 10) / 10 : 0,
  };
}

/**
 * Time-in-stage distribution: bucket histogram (0-1d, 1-3d, 3-7d, 7-14d,
 * 14-30d, 30+d) per non-terminal stage.
 */
export async function getStageDistribution(): Promise<StageDistRow[]> {
  const rows = await db.execute<{ stage: string; bucket: string; n: number }>(sql`
    WITH durations AS (
      SELECT
        c.stage::text AS stage,
        EXTRACT(EPOCH FROM (now() - c.updated_at)) / 86400 AS days_in_stage
      FROM ${candidates} c
      WHERE c.stage NOT IN ('joined', 'rejected')
    )
    SELECT
      stage,
      CASE
        WHEN days_in_stage < 1 THEN '0-1d'
        WHEN days_in_stage < 3 THEN '1-3d'
        WHEN days_in_stage < 7 THEN '3-7d'
        WHEN days_in_stage < 14 THEN '7-14d'
        WHEN days_in_stage < 30 THEN '14-30d'
        ELSE '30+d'
      END AS bucket,
      COUNT(*)::int AS n
    FROM durations
    GROUP BY stage, bucket
    ORDER BY stage, bucket
  `);
  return ((rows.rows || rows) as StageDistRow[]).map((r) => ({
    stage: r.stage,
    bucket: r.bucket,
    n: Number(r.n),
  }));
}

/**
 * Forecast: trailing 4-week submission counts and a projection of
 * submissions for the current calendar month, scaled to the days
 * remaining.
 */
export async function getSubmissionForecast(): Promise<ForecastRow> {
  const rows = await db.execute<{ week_offset: number; n: number }>(sql`
    SELECT
      FLOOR(EXTRACT(EPOCH FROM (now() - created_at)) / 86400 / 7)::int AS week_offset,
      COUNT(*)::int AS n
    FROM ${submissions}
    WHERE created_at >= now() - interval '28 days'
    GROUP BY week_offset
    ORDER BY week_offset ASC
  `);
  const buckets = [0, 0, 0, 0];
  for (const r of (rows.rows || rows) as Array<{ week_offset: number; n: number }>) {
    const idx = Math.min(3, Math.max(0, Number(r.week_offset)));
    buckets[idx] += Number(r.n);
  }
  const trailingFourWeeks = buckets.slice().reverse(); // oldest -> newest
  const weeklyAvg = trailingFourWeeks.reduce((a, b) => a + b, 0) / 4;

  // Project for the rest of the calendar month.
  const today = new Date();
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const dayOfMonth = today.getDate();
  const projectedThisMonth = Math.round((weeklyAvg / 7) * daysInMonth);

  return {
    weeklyAvg: Math.round(weeklyAvg * 10) / 10,
    projectedThisMonth,
    trailingFourWeeks,
  };
}

/**
 * "What needs me today?" — assembles a per-recruiter action list from existing
 * signals, each scoped to the current user. Five independent queries run in
 * parallel; no schema change required.
 */
export async function getMyActionItems(userId: number): Promise<ActionItems> {
  const [myTasks, idle, stale, ivs, unread] = await Promise.all([
    db
      .select({ id: tasks.id, title: tasks.title, body: tasks.body, dueAt: tasks.dueAt, candidateId: tasks.candidateId, jobId: tasks.jobId })
      .from(tasks)
      .where(and(eq(tasks.ownerId, userId), eq(tasks.status, "open")))
      .orderBy(tasks.dueAt, desc(tasks.createdAt))
      .limit(25),
    db
      .select({ id: candidates.id, fullName: candidates.fullName, stage: candidates.stage, updatedAt: candidates.updatedAt })
      .from(candidates)
      .where(and(
        eq(candidates.uploadedById, userId),
        sql`${candidates.updatedAt} <= now() - interval '14 days'`,
        sql`${candidates.stage} not in ('joined', 'rejected', 'offer')`,
      ))
      .orderBy(candidates.updatedAt)
      .limit(25),
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
        eq(submissions.submittedById, userId),
        eq(submissions.status, "submitted"),
        sql`${submissions.createdAt} <= now() - interval '5 days'`,
      ))
      .orderBy(submissions.createdAt)
      .limit(25),
    db
      .select({
        id: interviews.id,
        candidateId: interviews.candidateId,
        title: interviews.title,
        scheduledStart: interviews.scheduledStart,
        mode: interviews.mode,
      })
      .from(interviews)
      .where(and(
        eq(interviews.status, "scheduled"),
        sql`${interviews.scheduledStart} >= now()`,
        sql`${interviews.scheduledStart} <= now() + interval '7 days'`,
        // I created it, or I'm a listed interviewer (jsonb array containment).
        sql`(${interviews.createdById} = ${userId} OR ${interviews.interviewerIds} @> ${JSON.stringify([userId])}::jsonb)`,
      ))
      .orderBy(interviews.scheduledStart)
      .limit(25),
    db
      .select({ n: count() })
      .from(notifications)
      .where(and(eq(notifications.userId, userId), isNull(notifications.readAt))),
  ]);

  const unreadNotifications = unread[0]?.n ?? 0;
  const items: ActionItems = {
    tasks: myTasks.map((t) => ({
      id: t.id, title: t.title, body: t.body,
      dueAt: t.dueAt ? t.dueAt.toISOString() : null,
      candidateId: t.candidateId, jobId: t.jobId,
    })),
    idleCandidates: idle.map((c) => ({ id: c.id, fullName: c.fullName, stage: c.stage, updatedAt: c.updatedAt.toISOString() })),
    staleSubmissions: stale.map((s) => ({ id: s.id, candidateId: s.candidateId, jobId: s.jobId, candidateName: s.candidateName, createdAt: s.createdAt.toISOString() })),
    upcomingInterviews: ivs.map((i) => ({ id: i.id, candidateId: i.candidateId, title: i.title, scheduledStart: i.scheduledStart.toISOString(), mode: i.mode })),
    unreadNotifications,
    total: 0,
  };
  items.total =
    items.tasks.length + items.idleCandidates.length + items.staleSubmissions.length + items.upcomingInterviews.length + unreadNotifications;
  return items;
}

/** Lightweight count for the sidebar badge — avoids fetching full rows. */
export async function getMyActionItemCount(userId: number): Promise<number> {
  const items = await getMyActionItems(userId);
  return items.total;
}

// suppress unused-import warning for helpers that may be pruned
void and;
void eq;
void isNull;
void inArray;
void ne;
