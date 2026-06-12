"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { sequenceEnrollments, candidates } from "@/db/schema";
import { requireStaff } from "@/lib/rbac";
import { assertFeatureEnabled } from "@/lib/features";
import { getSequence } from "@/lib/sequences";
import { logAudit } from "@/lib/audit";

export async function enrollSequenceAction(
  candidateId: number,
  sequenceKey: string,
): Promise<{ ok: boolean; error?: string }> {
  const user = await requireStaff();
  await assertFeatureEnabled("email_sequences");

  const seq = getSequence(sequenceKey);
  if (!seq) return { ok: false, error: "Unknown sequence." };

  const cand = (await db.select({ id: candidates.id }).from(candidates).where(eq(candidates.id, candidateId)))[0];
  if (!cand) return { ok: false, error: "Candidate not found." };

  // Don't double-enroll in the same active sequence.
  const existing = (
    await db
      .select({ id: sequenceEnrollments.id })
      .from(sequenceEnrollments)
      .where(and(
        eq(sequenceEnrollments.candidateId, candidateId),
        eq(sequenceEnrollments.sequenceKey, sequenceKey),
        eq(sequenceEnrollments.status, "active"),
      ))
  )[0];
  if (existing) return { ok: false, error: "Already enrolled in this sequence." };

  await db.insert(sequenceEnrollments).values({
    candidateId,
    sequenceKey,
    stepIndex: 0,
    status: "active",
    enrolledById: Number(user.id),
  });

  await logAudit({
    actorId: Number(user.id),
    actorEmail: user.email,
    action: "create",
    targetType: "candidate",
    targetId: candidateId,
    summary: `Enrolled in sequence "${seq.label}"`,
    meta: { sequenceKey },
  });

  revalidatePath(`/candidates/${candidateId}`);
  return { ok: true };
}

export async function cancelSequenceAction(
  candidateId: number,
  enrollmentId: number,
): Promise<{ ok: boolean }> {
  const user = await requireStaff();
  await assertFeatureEnabled("email_sequences");
  await db
    .update(sequenceEnrollments)
    .set({ status: "cancelled", updatedAt: new Date() })
    .where(eq(sequenceEnrollments.id, enrollmentId));
  await logAudit({
    actorId: Number(user.id),
    actorEmail: user.email,
    action: "update",
    targetType: "candidate",
    targetId: candidateId,
    summary: "Cancelled email sequence",
  });
  revalidatePath(`/candidates/${candidateId}`);
  return { ok: true };
}
