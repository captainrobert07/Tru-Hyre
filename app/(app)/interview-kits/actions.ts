"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { interviewKits, jobs } from "@/db/schema";
import { requireStaff } from "@/lib/rbac";
import { assertFeatureEnabled } from "@/lib/features";
import { logAudit } from "@/lib/audit";

// Split a textarea (one item per line) into a trimmed, de-blanked array.
function lines(raw: string | undefined): string[] {
  return (raw || "")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 100);
}

const kitSchema = z.object({
  name: z.string().min(2).max(160),
  jobId: z.string().optional().or(z.literal("")),
  focusAreas: z.string().optional().or(z.literal("")),
  questions: z.string().optional().or(z.literal("")),
});

export async function saveInterviewKitAction(
  formData: FormData,
): Promise<{ ok: boolean; error?: string }> {
  const user = await requireStaff();
  await assertFeatureEnabled("interview_kits");
  const parsed = kitSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { ok: false, error: "Give the kit a name." };
  const v = parsed.data;

  const jobId = v.jobId ? Number(v.jobId) : null;
  if (jobId != null) {
    const job = (await db.select({ id: jobs.id }).from(jobs).where(eq(jobs.id, jobId)))[0];
    if (!job) return { ok: false, error: "That job no longer exists." };
  }

  await db.insert(interviewKits).values({
    name: v.name,
    jobId,
    focusAreas: lines(v.focusAreas),
    questions: lines(v.questions),
    createdById: Number(user.id),
  });

  await logAudit({
    actorId: Number(user.id), actorEmail: user.email, action: "create",
    targetType: "interview_kit", summary: `Created interview kit "${v.name}"`,
  });

  revalidatePath("/interview-kits");
  return { ok: true };
}

const editSchema = kitSchema.extend({ id: z.coerce.number().int().positive() });

export async function updateInterviewKitAction(
  formData: FormData,
): Promise<{ ok: boolean; error?: string }> {
  const user = await requireStaff();
  await assertFeatureEnabled("interview_kits");
  const parsed = editSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { ok: false, error: "Give the kit a name." };
  const v = parsed.data;

  const jobId = v.jobId ? Number(v.jobId) : null;
  if (jobId != null) {
    const job = (await db.select({ id: jobs.id }).from(jobs).where(eq(jobs.id, jobId)))[0];
    if (!job) return { ok: false, error: "That job no longer exists." };
  }

  const updated = await db
    .update(interviewKits)
    .set({ name: v.name, jobId, focusAreas: lines(v.focusAreas), questions: lines(v.questions) })
    .where(eq(interviewKits.id, v.id))
    .returning({ id: interviewKits.id });
  if (updated.length === 0) return { ok: false, error: "Kit not found." };

  await logAudit({
    actorId: Number(user.id), actorEmail: user.email, action: "update",
    targetType: "interview_kit", targetId: v.id, summary: `Updated interview kit "${v.name}"`,
  });

  revalidatePath("/interview-kits");
  return { ok: true };
}

export async function deleteInterviewKitAction(id: number): Promise<{ ok: boolean }> {
  const user = await requireStaff();
  await assertFeatureEnabled("interview_kits");
  const deleted = await db.delete(interviewKits).where(eq(interviewKits.id, id)).returning({ id: interviewKits.id });
  if (deleted.length === 0) return { ok: false };
  await logAudit({
    actorId: Number(user.id), actorEmail: user.email, action: "delete",
    targetType: "interview_kit", targetId: id, summary: "Deleted an interview kit",
  });
  revalidatePath("/interview-kits");
  return { ok: true };
}
