"use server";

import { randomBytes } from "crypto";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { db } from "@/db";
import { candidates, invitations } from "@/db/schema";
import { requireStaff } from "@/lib/rbac";
import { assertFeatureEnabled } from "@/lib/features";
import { sendEmail, inviteEmail } from "@/lib/email";
import { logAudit } from "@/lib/audit";
import { APP_NAME } from "@/lib/utils";

/**
 * Invite a candidate to the self-service portal. Creates a candidate-role
 * invitation bound to THIS candidate's id (so the resulting login can only ever
 * resolve to this profile) and emails them the activation link.
 */
export async function inviteCandidateToPortalAction(candidateId: number): Promise<{ ok: boolean; error?: string }> {
  const user = await requireStaff();
  await assertFeatureEnabled("candidate_portal");

  const cand = (await db.select().from(candidates).where(eq(candidates.id, candidateId)))[0];
  if (!cand) return { ok: false, error: "Candidate not found." };
  if (!cand.email) return { ok: false, error: "This candidate has no email address." };

  // Don't create a duplicate pending invite for the same email.
  const existing = (await db.select({ id: invitations.id }).from(invitations)
    .where(and(eq(invitations.email, cand.email), eq(invitations.status, "pending"))))[0];
  if (existing) return { ok: false, error: "There's already a pending invitation for this email." };

  const token = randomBytes(24).toString("hex");
  const expires = new Date();
  expires.setDate(expires.getDate() + 30);
  await db.insert(invitations).values({
    email: cand.email,
    role: "candidate",
    token,
    invitedById: Number(user.id),
    candidateProfileId: candidateId,
    expiresAt: expires,
  });

  // Build an absolute invite URL from the request host.
  const h = await headers();
  const host = h.get("x-forwarded-host") || h.get("host") || "";
  const proto = h.get("x-forwarded-proto") || "https";
  const inviteUrl = `${proto}://${host}/invite/${token}`;
  const mail = inviteEmail({ appName: APP_NAME, inviteeEmail: cand.email, role: "candidate", inviteUrl });
  await sendEmail({ to: cand.email, subject: mail.subject, text: mail.text, html: mail.html });

  await logAudit({
    actorId: Number(user.id), actorEmail: user.email, action: "invite",
    targetType: "candidate", targetId: candidateId,
    summary: `Invited ${cand.fullName} to the candidate portal`,
  });

  revalidatePath(`/candidates/${candidateId}`);
  return { ok: true };
}
