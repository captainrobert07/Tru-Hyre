"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { candidates, candidateReferences } from "@/db/schema";
import { sendEmail } from "@/lib/email";
import { logAudit } from "@/lib/audit";
import { requireStaff } from "@/lib/rbac";
import { assertFeatureEnabled } from "@/lib/features";
import { APP_NAME } from "@/lib/utils";

const requestSchema = z.object({
  refereeName: z.string().min(2).max(160),
  refereeEmail: z.string().email().max(254),
  relationship: z.string().max(120).optional().or(z.literal("")),
});

export async function requestReferenceAction(
  candidateId: number,
  formData: FormData,
): Promise<{ ok: boolean; error?: string }> {
  const user = await requireStaff();
  await assertFeatureEnabled("reference_checks");
  const parsed = requestSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { ok: false, error: "Enter the referee's name and email." };
  const v = parsed.data;

  const cand = (await db.select({ fullName: candidates.fullName }).from(candidates).where(eq(candidates.id, candidateId)))[0];
  if (!cand) return { ok: false, error: "Candidate not found." };

  await db.insert(candidateReferences).values({
    candidateId,
    refereeName: v.refereeName,
    refereeEmail: v.refereeEmail,
    relationship: v.relationship || null,
    status: "requested",
    requestedById: Number(user.id),
  });

  // Email the referee (best-effort; reply lands in the shared mailbox and HR
  // logs the response back here via markReferenceReceivedAction).
  const subject = `Reference request for ${cand.fullName}`;
  const text =
    `Hi ${v.refereeName.split(/\s+/)[0]},\n\n` +
    `${user.fullName} at ${APP_NAME} is conducting a reference check for ${cand.fullName}, ` +
    `who listed you as a referee${v.relationship ? ` (${v.relationship})` : ""}.\n\n` +
    `Could you reply to this email with a few words on your experience working with them — ` +
    `their strengths, role, and whether you'd work with them again? It only takes a minute and is greatly appreciated.\n\n` +
    `Thank you,\n${user.fullName}\n${APP_NAME}`;
  await sendEmail({ to: v.refereeEmail, subject, text });

  await logAudit({
    actorId: Number(user.id), actorEmail: user.email, action: "create",
    targetType: "candidate", targetId: candidateId,
    summary: `Requested reference from ${v.refereeName} for ${cand.fullName}`,
  });

  revalidatePath(`/candidates/${candidateId}`);
  return { ok: true };
}

const receiveSchema = z.object({
  response: z.string().min(1).max(4000),
});

export async function markReferenceReceivedAction(
  candidateId: number,
  referenceId: number,
  formData: FormData,
): Promise<{ ok: boolean; error?: string }> {
  const user = await requireStaff();
  await assertFeatureEnabled("reference_checks");
  const parsed = receiveSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { ok: false, error: "Paste the referee's response." };

  await db
    .update(candidateReferences)
    .set({ status: "received", response: parsed.data.response, respondedAt: new Date() })
    .where(eq(candidateReferences.id, referenceId));

  await logAudit({
    actorId: Number(user.id), actorEmail: user.email, action: "update",
    targetType: "candidate", targetId: candidateId, summary: "Logged a reference response",
  });

  revalidatePath(`/candidates/${candidateId}`);
  return { ok: true };
}
