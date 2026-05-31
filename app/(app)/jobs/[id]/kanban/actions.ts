"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { submissions, candidates, stageHistory, jobs } from "@/db/schema";
import { logAudit } from "@/lib/audit";
import { fireStageTransitionEmail } from "@/lib/email-on-stage-change";
import { requireStaff } from "@/lib/rbac";

const SUBMISSION_STATUSES = ["submitted", "shortlist", "reject", "interview", "hold", "offer", "joined"] as const;
const STAGES = ["received", "hr_review", "screening", "submitted", "shortlist", "interview", "hold", "offer", "joined", "rejected"] as const;

const schema = z.object({
  submissionId: z.coerce.number().int().positive(),
  status: z.enum(SUBMISSION_STATUSES),
});

export async function moveSubmissionAction(
  input: unknown,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await requireStaff();
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input." };

  const { submissionId, status } = parsed.data;

  const sub = (await db.select().from(submissions).where(eq(submissions.id, submissionId)))[0];
  if (!sub) return { ok: false, error: "Submission not found." };

  await db.update(submissions).set({ status, updatedAt: new Date() }).where(eq(submissions.id, submissionId));

  // Mirror to candidate.stage. Submission "reject" -> candidate "rejected".
  // Submission "submitted/shortlist/interview/hold/offer/joined" map 1:1.
  const candidateStage = status === "reject" ? "rejected" : (status as (typeof STAGES)[number]);
  let stageDidChange: { from: string; cand: typeof candidates.$inferSelect } | null = null;
  if (STAGES.includes(candidateStage)) {
    const candFull = (await db.select().from(candidates).where(eq(candidates.id, sub.candidateId)))[0];
    if (candFull && candFull.stage !== candidateStage) {
      await db.update(candidates).set({ stage: candidateStage, updatedAt: new Date() }).where(eq(candidates.id, sub.candidateId));
      await db.insert(stageHistory).values({
        candidateId: sub.candidateId,
        fromStage: candFull.stage,
        toStage: candidateStage,
        changedById: Number(user.id),
        note: "Moved via Kanban drag-drop",
      });
      stageDidChange = { from: candFull.stage, cand: candFull };
    }
  }

  await logAudit({
    actorId: Number(user.id),
    actorEmail: user.email,
    action: "update",
    targetType: "submission",
    targetId: submissionId,
    summary: `Kanban move → ${status}`,
  });

  if (stageDidChange) {
    const job = (await db.select({ title: jobs.title }).from(jobs).where(eq(jobs.id, sub.jobId)))[0];
    await fireStageTransitionEmail({
      candidate: {
        id: stageDidChange.cand.id,
        fullName: stageDidChange.cand.fullName,
        email: stageDidChange.cand.email,
        refId: stageDidChange.cand.refId,
      },
      fromStage: stageDidChange.from,
      toStage: candidateStage,
      actor: { id: Number(user.id), email: user.email, fullName: user.fullName },
      jobTitle: job?.title,
    });
  }

  revalidatePath(`/jobs/${sub.jobId}/kanban`);
  revalidatePath(`/candidates/${sub.candidateId}`);
  return { ok: true };
}
