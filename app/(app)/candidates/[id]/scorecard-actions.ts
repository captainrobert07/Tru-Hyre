"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { candidates, interviewFeedback, feedbackEvents } from "@/db/schema";
import { logAudit } from "@/lib/audit";
import { requireStaff } from "@/lib/rbac";

// Fixed default criteria. (Per-job custom criteria is a follow-on.)
const VERDICTS = ["strong_yes", "yes", "no", "strong_no"] as const;

const schema = z.object({
  verdict: z.enum(VERDICTS),
  submissionId: z.coerce.number().int().positive().optional().or(z.literal("")),
  interviewId: z.coerce.number().int().positive().optional().or(z.literal("")),
  technical: z.coerce.number().int().min(1).max(5).optional(),
  communication: z.coerce.number().int().min(1).max(5).optional(),
  culture: z.coerce.number().int().min(1).max(5).optional(),
  body: z.string().max(4000).optional().or(z.literal("")),
});

const VERDICT_LABEL: Record<string, string> = {
  strong_yes: "Strong yes",
  yes: "Yes",
  no: "No",
  strong_no: "Strong no",
};

export async function submitScorecardAction(
  candidateId: number,
  formData: FormData,
): Promise<{ ok: boolean; error?: string }> {
  const user = await requireStaff();
  const parsed = schema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { ok: false, error: "Pick an overall verdict." };
  const v = parsed.data;

  const cand = (await db.select({ id: candidates.id, fullName: candidates.fullName }).from(candidates).where(eq(candidates.id, candidateId)))[0];
  if (!cand) return { ok: false, error: "Candidate not found." };

  const scores: Record<string, number> = {};
  if (v.technical) scores.technical = v.technical;
  if (v.communication) scores.communication = v.communication;
  if (v.culture) scores.culture = v.culture;

  const submissionId = v.submissionId ? Number(v.submissionId) : null;
  const interviewId = v.interviewId ? Number(v.interviewId) : null;

  await db.insert(interviewFeedback).values({
    candidateId,
    submissionId,
    interviewId,
    reviewerId: Number(user.id),
    verdict: v.verdict,
    scores,
    body: v.body || null,
  });

  // Mirror into feedbackEvents so it appears on the activity timeline. That
  // table requires a submission, so only write when one is linked.
  if (submissionId) {
    const avg = Object.values(scores).length
      ? (Object.values(scores).reduce((a, b) => a + b, 0) / Object.values(scores).length).toFixed(1)
      : "—";
    const summary = `Scorecard: ${VERDICT_LABEL[v.verdict]} (avg ${avg}/5)${v.body ? ` — ${v.body}` : ""}`;
    await db.insert(feedbackEvents).values({
      submissionId,
      kind: "note",
      body: summary.slice(0, 2000),
      authorId: Number(user.id),
    });
  }

  await logAudit({
    actorId: Number(user.id),
    actorEmail: user.email,
    action: "feedback",
    targetType: "candidate",
    targetId: candidateId,
    summary: `Submitted scorecard for ${cand.fullName}: ${VERDICT_LABEL[v.verdict]}`,
    meta: { verdict: v.verdict, scores, submissionId, interviewId },
  });

  revalidatePath(`/candidates/${candidateId}`);
  return { ok: true };
}
