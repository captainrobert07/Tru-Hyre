"use server";

import { eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import {
  candidates, resumeFiles, clientPackets, stageHistory, submissions,
  interviews, interviewFeedback, offers, emailOutbox, inboundMessages, comments,
} from "@/db/schema";
import { requireStaff } from "@/lib/rbac";
import { assertFeatureEnabled } from "@/lib/features";
import { logAudit } from "@/lib/audit";

/**
 * Merge candidate `loserId` INTO `winnerId`: reparent all child records to the
 * winner, backfill any empty winner fields from the loser, then delete the
 * loser. Admin-only (destructive, irreversible). Audit-logged with both refs.
 */
export async function mergeCandidatesAction(
  winnerId: number,
  loserId: number,
): Promise<{ ok: boolean; error?: string }> {
  const user = await requireStaff();
  if (user.role !== "admin") return { ok: false, error: "Only admins can merge candidates." };
  await assertFeatureEnabled("ai_dedupe");
  if (winnerId === loserId) return { ok: false, error: "Pick two different candidates." };

  const [winner, loser] = await Promise.all([
    db.select().from(candidates).where(eq(candidates.id, winnerId)).then((r) => r[0]),
    db.select().from(candidates).where(eq(candidates.id, loserId)).then((r) => r[0]),
  ]);
  if (!winner || !loser) return { ok: false, error: "One of the candidates no longer exists." };

  // 1. Reparent child records to the winner.
  await Promise.all([
    db.update(resumeFiles).set({ candidateId: winnerId }).where(eq(resumeFiles.candidateId, loserId)),
    db.update(clientPackets).set({ candidateId: winnerId }).where(eq(clientPackets.candidateId, loserId)),
    db.update(stageHistory).set({ candidateId: winnerId }).where(eq(stageHistory.candidateId, loserId)),
    db.update(submissions).set({ candidateId: winnerId }).where(eq(submissions.candidateId, loserId)),
    db.update(interviews).set({ candidateId: winnerId }).where(eq(interviews.candidateId, loserId)),
    db.update(interviewFeedback).set({ candidateId: winnerId }).where(eq(interviewFeedback.candidateId, loserId)),
    db.update(offers).set({ candidateId: winnerId }).where(eq(offers.candidateId, loserId)),
    db.update(emailOutbox).set({ candidateId: winnerId }).where(eq(emailOutbox.candidateId, loserId)),
    db.update(inboundMessages).set({ candidateId: winnerId }).where(eq(inboundMessages.candidateId, loserId)),
  ]);
  // Comments reference candidate by (targetType,targetId) — reparent those too.
  await db.execute(sql`
    UPDATE comments SET target_id = ${winnerId}
    WHERE target_type = 'candidate' AND target_id = ${loserId}
  `);

  // 2. Backfill empty winner fields from loser (don't overwrite existing data).
  const merged: Record<string, unknown> = { updatedAt: new Date() };
  const copyIfEmpty = (field: keyof typeof winner, val: unknown) => {
    if ((winner[field] === null || winner[field] === undefined || winner[field] === "") && val) merged[field] = val;
  };
  copyIfEmpty("email", loser.email);
  copyIfEmpty("phone", loser.phone);
  copyIfEmpty("location", loser.location);
  copyIfEmpty("currentTitle", loser.currentTitle);
  copyIfEmpty("currentCompany", loser.currentCompany);
  copyIfEmpty("experienceYears", loser.experienceYears);
  copyIfEmpty("currentCtc", loser.currentCtc);
  copyIfEmpty("expectedCtc", loser.expectedCtc);
  copyIfEmpty("summary", loser.summary);
  copyIfEmpty("linkedinUrl", loser.linkedinUrl);
  copyIfEmpty("githubUrl", loser.githubUrl);
  // Union skills + tags.
  const skills = Array.from(new Set([...(winner.skills || []), ...(loser.skills || [])])).slice(0, 50);
  const tags = Array.from(new Set([...(winner.tags || []), ...(loser.tags || [])])).slice(0, 30);
  merged.skills = skills;
  merged.tags = tags;
  await db.update(candidates).set(merged).where(eq(candidates.id, winnerId));

  // 3. Delete the loser (children already reparented, so nothing cascades away).
  await db.delete(candidates).where(eq(candidates.id, loserId));

  await logAudit({
    actorId: Number(user.id),
    actorEmail: user.email,
    action: "delete",
    targetType: "candidate",
    targetId: loserId,
    summary: `Merged ${loser.fullName} (${loser.refId}) into ${winner.fullName} (${winner.refId})`,
    meta: { winnerId, loserId, winnerRef: winner.refId, loserRef: loser.refId },
  });

  revalidatePath("/candidates/duplicates");
  revalidatePath("/candidates");
  revalidatePath(`/candidates/${winnerId}`);
  return { ok: true };
}
