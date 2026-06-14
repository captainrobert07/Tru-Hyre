"use server";

import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { jobs, jobStageChecklists } from "@/db/schema";
import { requireStaff } from "@/lib/rbac";
import { assertFeatureEnabled } from "@/lib/features";
import { logAudit } from "@/lib/audit";

// Stages that carry advisory checklist items. Mirrors candidateStageEnum minus
// the terminal/parking states where a checklist adds no value.
const CHECKLIST_STAGES = [
  "received",
  "hr_review",
  "screening",
  "submitted",
  "shortlist",
  "interview",
  "offer",
  "joined",
] as const;

const addSchema = z.object({
  stage: z.enum(CHECKLIST_STAGES),
  label: z.string().min(2).max(200),
});

export async function addChecklistItemAction(
  jobId: number,
  formData: FormData,
): Promise<{ ok: boolean; error?: string }> {
  const user = await requireStaff();
  await assertFeatureEnabled("stage_checklists");
  const parsed = addSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { ok: false, error: "Pick a stage and enter a checklist item." };
  const { stage, label } = parsed.data;

  const job = (await db.select({ id: jobs.id }).from(jobs).where(eq(jobs.id, jobId)))[0];
  if (!job) return { ok: false, error: "Job not found." };

  // Append after the last item in this stage.
  const [{ next }] = await db
    .select({ next: sql<number>`coalesce(max(${jobStageChecklists.sortOrder}), -1) + 1` })
    .from(jobStageChecklists)
    .where(and(eq(jobStageChecklists.jobId, jobId), eq(jobStageChecklists.stage, stage)));

  await db.insert(jobStageChecklists).values({ jobId, stage, label, sortOrder: next });

  await logAudit({
    actorId: Number(user.id), actorEmail: user.email, action: "update",
    targetType: "job", targetId: jobId,
    summary: `Added "${stage.replaceAll("_", " ")}" checklist item: ${label}`,
  });

  revalidatePath(`/jobs/${jobId}`);
  return { ok: true };
}

export async function deleteChecklistItemAction(
  jobId: number,
  itemId: number,
): Promise<{ ok: boolean }> {
  const user = await requireStaff();
  await assertFeatureEnabled("stage_checklists");

  // Scope the delete to this job so an item id from another job can't be removed.
  const deleted = await db
    .delete(jobStageChecklists)
    .where(and(eq(jobStageChecklists.id, itemId), eq(jobStageChecklists.jobId, jobId)))
    .returning({ id: jobStageChecklists.id });
  if (deleted.length === 0) return { ok: false };

  await logAudit({
    actorId: Number(user.id), actorEmail: user.email, action: "update",
    targetType: "job", targetId: jobId, summary: "Removed a stage checklist item",
  });

  revalidatePath(`/jobs/${jobId}`);
  return { ok: true };
}
