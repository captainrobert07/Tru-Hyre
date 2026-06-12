"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { candidates, offers } from "@/db/schema";
import { requireStaff } from "@/lib/rbac";
import { assertFeatureEnabled } from "@/lib/features";
import { logAudit } from "@/lib/audit";

const createSchema = z.object({
  title: z.string().max(200).optional().or(z.literal("")),
  ctc: z.string().max(20).optional().or(z.literal("")),
  currency: z.string().max(8).optional().or(z.literal("")),
  joiningDate: z.string().optional().or(z.literal("")),
  expiresOn: z.string().optional().or(z.literal("")),
  jobId: z.coerce.number().int().positive().optional().or(z.literal("")),
  notes: z.string().max(2000).optional().or(z.literal("")),
});

const STATUSES = ["draft", "extended", "accepted", "declined", "withdrawn"] as const;

export async function createOfferAction(
  candidateId: number,
  formData: FormData,
): Promise<{ ok: boolean; error?: string }> {
  const user = await requireStaff();
  await assertFeatureEnabled("offers");
  const parsed = createSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { ok: false, error: "Check the offer details." };
  const v = parsed.data;

  const cand = (await db.select({ fullName: candidates.fullName }).from(candidates).where(eq(candidates.id, candidateId)))[0];
  if (!cand) return { ok: false, error: "Candidate not found." };

  const ctcNum = v.ctc ? Number(v.ctc.replace(/[, ]/g, "")) : null;

  await db.insert(offers).values({
    candidateId,
    jobId: v.jobId ? Number(v.jobId) : null,
    title: v.title || null,
    ctc: ctcNum && Number.isFinite(ctcNum) ? String(Math.round(ctcNum)) : null,
    currency: v.currency || "INR",
    joiningDate: v.joiningDate || null,
    expiresOn: v.expiresOn || null,
    status: "draft",
    notes: v.notes || null,
    createdById: Number(user.id),
  });

  await logAudit({
    actorId: Number(user.id),
    actorEmail: user.email,
    action: "create",
    targetType: "offer",
    targetId: candidateId,
    summary: `Created offer for ${cand.fullName}`,
  });

  revalidatePath(`/candidates/${candidateId}`);
  return { ok: true };
}

export async function setOfferStatusAction(
  candidateId: number,
  offerId: number,
  status: string,
): Promise<{ ok: boolean; error?: string }> {
  const user = await requireStaff();
  await assertFeatureEnabled("offers");
  if (!(STATUSES as readonly string[]).includes(status)) return { ok: false, error: "Invalid status." };

  await db
    .update(offers)
    .set({ status: status as typeof STATUSES[number], updatedAt: new Date() })
    .where(eq(offers.id, offerId));

  await logAudit({
    actorId: Number(user.id),
    actorEmail: user.email,
    action: "update",
    targetType: "offer",
    targetId: offerId,
    summary: `Offer marked ${status}`,
  });

  revalidatePath(`/candidates/${candidateId}`);
  return { ok: true };
}
