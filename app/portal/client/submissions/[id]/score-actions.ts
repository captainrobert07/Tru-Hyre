"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { clientFeedbackScores, feedbackEvents, submissions, jobs, users, notifications, candidates } from "@/db/schema";
import { requireClient } from "@/lib/rbac";
import { assertFeatureEnabled } from "@/lib/features";
import { logAudit } from "@/lib/audit";

const scoreSchema = z.object({
  overallScore: z.coerce.number().int().min(1).max(5),
  technical: z.coerce.number().int().min(1).max(5).optional().or(z.literal("")),
  cultural_fit: z.coerce.number().int().min(1).max(5).optional().or(z.literal("")),
  communication: z.coerce.number().int().min(1).max(5).optional().or(z.literal("")),
  comment: z.string().max(2000).optional().or(z.literal("")),
});

async function ensureAccess(submissionId: number, userId: number, userRole: string) {
  const row = (
    await db
      .select({ candidateId: submissions.candidateId, jobClientId: jobs.clientAccountId, submittedById: submissions.submittedById })
      .from(submissions)
      .innerJoin(jobs, eq(submissions.jobId, jobs.id))
      .where(eq(submissions.id, submissionId))
  )[0];
  if (!row) return null;
  if (userRole === "admin") return row;
  const u = (await db.select().from(users).where(eq(users.id, userId)))[0];
  if (!u || u.clientAccountId !== row.jobClientId) return null;
  return row;
}

export async function submitClientScoreAction(
  submissionId: number,
  formData: FormData,
): Promise<{ ok: boolean; error?: string }> {
  await assertFeatureEnabled("client_feedback_scores");
  const me = await requireClient();
  const access = await ensureAccess(submissionId, Number(me.id), me.role);
  if (!access) return { ok: false, error: "Forbidden" };

  const parsed = scoreSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { ok: false, error: "Pick an overall score." };
  const v = parsed.data;

  const criteriaScores: Record<string, number> = {};
  if (v.technical && v.technical !== "") criteriaScores.technical = Number(v.technical);
  if (v.cultural_fit && v.cultural_fit !== "") criteriaScores.cultural_fit = Number(v.cultural_fit);
  if (v.communication && v.communication !== "") criteriaScores.communication = Number(v.communication);

  const existing = (
    await db.select().from(clientFeedbackScores)
      .where(and(eq(clientFeedbackScores.submissionId, submissionId), eq(clientFeedbackScores.authorId, Number(me.id))))
  )[0];

  if (existing) {
    await db.update(clientFeedbackScores)
      .set({ overallScore: v.overallScore, criteriaScores, comment: v.comment || null, updatedAt: new Date() })
      .where(eq(clientFeedbackScores.id, existing.id));
  } else {
    await db.insert(clientFeedbackScores).values({
      submissionId, authorId: Number(me.id), overallScore: v.overallScore, criteriaScores, comment: v.comment || null,
    });
  }

  const cand = (await db.select({ fullName: candidates.fullName }).from(candidates).where(eq(candidates.id, access.candidateId)))[0];
  // Mirror into the feedback timeline.
  await db.insert(feedbackEvents).values({
    submissionId, kind: "score", body: `Client score: ${v.overallScore}/5${v.comment ? ` — ${v.comment}` : ""}`, authorId: Number(me.id),
  });
  // Notify the HR owner.
  if (access.submittedById) {
    await db.insert(notifications).values({
      userId: access.submittedById, kind: "feedback",
      title: `Client score: ${v.overallScore}/5`, body: cand?.fullName || "",
      url: `/candidates/${access.candidateId}`,
    });
  }
  await logAudit({
    actorId: Number(me.id), actorEmail: me.email, action: "feedback",
    targetType: "submission", targetId: submissionId,
    summary: `Client scored ${cand?.fullName || "candidate"}: ${v.overallScore}/5`,
  });

  revalidatePath(`/portal/client/submissions/${submissionId}`);
  return { ok: true };
}
