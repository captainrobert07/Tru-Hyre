"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { db } from "@/db";
import { invitations, users } from "@/db/schema";
import { logAudit } from "@/lib/audit";

export async function acceptInvitationAction(token: string, formData: FormData): Promise<void> {
  const inv = (await db.select().from(invitations).where(eq(invitations.token, token)).limit(1))[0];
  if (!inv) redirect(`/invite/${token}?error=invalid`);
  if (inv.status !== "pending") redirect(`/invite/${token}`);
  if (inv.expiresAt && new Date(inv.expiresAt) < new Date()) redirect(`/invite/${token}`);
  // A candidate-role invite MUST be bound to a candidate profile, or the portal
  // login would have nothing to scope to. Reject an unbound candidate invite.
  if (inv.role === "candidate" && !inv.candidateProfileId) redirect(`/invite/${token}?error=invalid`);

  const fullName = ((formData.get("fullName") as string) || "").trim();
  const password = ((formData.get("password") as string) || "").trim();
  if (fullName.length < 2) redirect(`/invite/${token}?error=invalid`);
  if (password.length < 8) redirect(`/invite/${token}?error=weak_password`);

  const existing = (await db.select().from(users).where(eq(users.email, inv.email)).limit(1))[0];
  if (existing) redirect(`/invite/${token}?error=email_taken`);

  const passwordHash = await bcrypt.hash(password, 10);
  await db.insert(users).values({
    email: inv.email,
    fullName,
    role: inv.role,
    clientAccountId: inv.clientAccountId,
    vendorAccountId: inv.vendorAccountId,
    candidateProfileId: inv.candidateProfileId ?? null,
    isActive: true,
    passwordHash,
  });

  await db
    .update(invitations)
    .set({ status: "accepted", acceptedAt: new Date() })
    .where(eq(invitations.id, inv.id));

  await logAudit({
    actorEmail: inv.email,
    action: "create",
    targetType: "user",
    summary: `Accepted invitation as ${inv.role}`,
    meta: { invitationId: inv.id },
  });

  redirect("/login?accepted=1");
}
