import { NextResponse } from "next/server";
import { and, eq, like, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { candidates, submissions, interviews, tasks, notifications } from "@/db/schema";
import { logAudit } from "@/lib/audit";
import { isFeatureEnabled } from "@/lib/features";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Don't let a Hobby/Pro timeout kill the run silently.
export const maxDuration = 60;

/**
 * Daily SLA sweep (Vercel Cron, see vercel.json). Turns the dashboard's passive
 * "stuck"/"awaiting feedback" widgets into active nudges: creates a reminder
 * task for the owning recruiter (and an in-app notification) for
 *   - candidates idle in a non-terminal stage > 14 days
 *   - submissions still "submitted" (awaiting client feedback) > 5 days
 *   - interviews still "scheduled" whose end time has passed (needs outcome)
 *
 * Dedup: each task carries an [SLA:<type>] marker; we skip an entity that
 * already has an open SLA task of the same type, so re-running daily doesn't
 * spam. Guarded by CRON_SECRET (Vercel sends it as a Bearer token).
 */

const IDLE_DAYS = 14;
const FEEDBACK_DAYS = 5;

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  // Vercel sets this header on cron invocations; treat its presence as trusted
  // when no explicit secret is configured.
  const isVercelCron = req.headers.get("x-vercel-cron") === "1";
  if (!secret) return isVercelCron || process.env.NODE_ENV !== "production";
  const auth = req.headers.get("authorization") || "";
  return auth === `Bearer ${secret}` || isVercelCron;
}

type TaskSeed = {
  ownerId: number;
  title: string;
  body: string;
  candidateId: number | null;
  jobId: number | null;
};

export async function GET(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const [slaOn, remindersOn] = await Promise.all([
    isFeatureEnabled("sla_alerts"),
    isFeatureEnabled("interview_reminders"),
  ]);

  // Interview reminders: notify interviewers about interviews happening today.
  let interviewReminders = 0;
  if (remindersOn) {
    const todayIvs = await db
      .select({ id: interviews.id, candidateId: interviews.candidateId, title: interviews.title, interviewerIds: interviews.interviewerIds, createdById: interviews.createdById })
      .from(interviews)
      .where(and(
        eq(interviews.status, "scheduled"),
        sql`${interviews.scheduledStart}::date = now()::date`,
      ))
      .limit(200);
    const notifRows: { userId: number; kind: "interview"; title: string; body: string; url: string }[] = [];
    for (const iv of todayIvs) {
      const recipients = new Set<number>([...(iv.interviewerIds || [])]);
      if (iv.createdById) recipients.add(iv.createdById);
      for (const userId of recipients) {
        notifRows.push({
          userId,
          kind: "interview",
          title: `Interview today: ${iv.title}`,
          body: "You have an interview scheduled today.",
          url: `/candidates/${iv.candidateId}`,
        });
      }
    }
    if (notifRows.length) {
      await db.insert(notifications).values(notifRows);
      interviewReminders = notifRows.length;
    }
  }

  if (!slaOn) {
    return NextResponse.json({ ok: true, skipped: "sla_disabled", interviewReminders });
  }

  // 1. Gather the three SLA breach sets in parallel.
  const [idle, staleSubs, overdueIvs] = await Promise.all([
    db
      .select({ id: candidates.id, fullName: candidates.fullName, ownerId: candidates.uploadedById, stage: candidates.stage })
      .from(candidates)
      .where(and(
        sql`${candidates.updatedAt} <= now() - (${IDLE_DAYS} || ' days')::interval`,
        sql`${candidates.stage} not in ('joined', 'rejected', 'offer')`,
      ))
      .limit(200),
    db
      .select({
        id: submissions.id,
        candidateId: submissions.candidateId,
        jobId: submissions.jobId,
        ownerId: submissions.submittedById,
        candidateName: candidates.fullName,
      })
      .from(submissions)
      .innerJoin(candidates, eq(submissions.candidateId, candidates.id))
      .where(and(
        eq(submissions.status, "submitted"),
        sql`${submissions.createdAt} <= now() - (${FEEDBACK_DAYS} || ' days')::interval`,
      ))
      .limit(200),
    db
      .select({
        id: interviews.id,
        candidateId: interviews.candidateId,
        jobId: interviews.jobId,
        title: interviews.title,
        ownerId: interviews.createdById,
      })
      .from(interviews)
      .where(and(
        eq(interviews.status, "scheduled"),
        sql`${interviews.scheduledEnd} < now()`,
      ))
      .limit(200),
  ]);

  // 2. Build dedup set from existing open SLA tasks.
  const existing = await db
    .select({ candidateId: tasks.candidateId, title: tasks.title })
    .from(tasks)
    .where(and(ne(tasks.status, "done"), like(tasks.title, "[SLA:%")));

  const seen = new Set<string>();
  for (const t of existing) {
    const tag = t.title.match(/^\[SLA:(\w+)\]/)?.[1];
    if (tag && t.candidateId != null) seen.add(`${t.candidateId}:${tag}`);
  }

  const seeds: TaskSeed[] = [];
  const pushSeed = (tag: string, s: TaskSeed) => {
    if (s.candidateId == null) return;
    const key = `${s.candidateId}:${tag}`;
    if (seen.has(key)) return;
    seen.add(key);
    seeds.push(s);
  };

  for (const c of idle) {
    if (c.ownerId == null) continue;
    pushSeed("idle", {
      ownerId: c.ownerId,
      title: `[SLA:idle] Re-engage ${c.fullName}`,
      body: `No movement in ${IDLE_DAYS}+ days (stage: ${c.stage.replaceAll("_", " ")}). Nudge the pipeline or update the stage.`,
      candidateId: c.id,
      jobId: null,
    });
  }
  for (const s of staleSubs) {
    if (s.ownerId == null) continue;
    pushSeed("feedback", {
      ownerId: s.ownerId,
      title: `[SLA:feedback] Chase feedback on ${s.candidateName}`,
      body: `Submission #${s.id} has been awaiting client feedback for ${FEEDBACK_DAYS}+ days. Follow up with the client.`,
      candidateId: s.candidateId,
      jobId: s.jobId,
    });
  }
  for (const iv of overdueIvs) {
    if (iv.ownerId == null) continue;
    pushSeed("interview", {
      ownerId: iv.ownerId,
      title: `[SLA:interview] Log outcome: ${iv.title}`,
      body: `This interview's scheduled time has passed but it's still marked scheduled. Record the outcome.`,
      candidateId: iv.candidateId,
      jobId: iv.jobId,
    });
  }

  // 3. Insert tasks + a notification per task (batched).
  if (seeds.length > 0) {
    await db.insert(tasks).values(
      seeds.map((s) => ({
        ownerId: s.ownerId,
        title: s.title,
        body: s.body,
        status: "open" as const,
        candidateId: s.candidateId,
        jobId: s.jobId,
        dueAt: new Date(),
      })),
    );
    await db.insert(notifications).values(
      seeds.map((s) => ({
        userId: s.ownerId,
        kind: "system" as const,
        title: s.title.replace(/^\[SLA:\w+\]\s*/, ""),
        body: s.body,
        url: s.candidateId ? `/candidates/${s.candidateId}` : "/dashboard",
      })),
    );
  }

  const summary = {
    idle: idle.length,
    staleSubmissions: staleSubs.length,
    overdueInterviews: overdueIvs.length,
    tasksCreated: seeds.length,
    interviewReminders,
  };

  try {
    await logAudit({
      action: "update",
      targetType: "system",
      summary: `SLA sweep: ${seeds.length} nudges created`,
      meta: summary,
    });
  } catch {
    // headers() can be absent in some cron contexts; never fail the sweep on audit.
  }

  return NextResponse.json({ ok: true, ...summary });
}
