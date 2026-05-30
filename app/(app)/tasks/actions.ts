"use server";

import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { tasks } from "@/db/schema";
import { logAudit } from "@/lib/audit";
import { requireStaff } from "@/lib/rbac";

const createSchema = z.object({
  title: z.string().min(1).max(240),
  body: z.string().max(2000).optional(),
  dueAt: z.string().optional(),
  candidateId: z.coerce.number().int().positive().optional(),
  jobId: z.coerce.number().int().positive().optional(),
});

export async function createTaskAction(formData: FormData): Promise<void> {
  const me = await requireStaff();
  const parsed = createSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return;
  const v = parsed.data;
  await db.insert(tasks).values({
    ownerId: Number(me.id),
    title: v.title,
    body: v.body || null,
    dueAt: v.dueAt ? new Date(v.dueAt) : null,
    candidateId: v.candidateId || null,
    jobId: v.jobId || null,
    status: "open",
  });
  await logAudit({
    actorId: Number(me.id),
    actorEmail: me.email,
    action: "create",
    targetType: "task",
    summary: `Created task: ${v.title}`,
    meta: { candidateId: v.candidateId, jobId: v.jobId },
  });
  revalidatePath("/dashboard");
  if (v.candidateId) revalidatePath(`/candidates/${v.candidateId}`);
  if (v.jobId) revalidatePath(`/jobs/${v.jobId}`);
}

export async function completeTaskAction(id: number): Promise<void> {
  const me = await requireStaff();
  await db
    .update(tasks)
    .set({ status: "done", completedAt: new Date() })
    .where(and(eq(tasks.id, id), eq(tasks.ownerId, Number(me.id))));
  revalidatePath("/dashboard");
}

export async function snoozeTaskAction(id: number, days: number): Promise<void> {
  const me = await requireStaff();
  const due = new Date();
  due.setDate(due.getDate() + Math.max(1, Math.min(30, days)));
  await db
    .update(tasks)
    .set({ status: "open", dueAt: due })
    .where(and(eq(tasks.id, id), eq(tasks.ownerId, Number(me.id))));
  revalidatePath("/dashboard");
}

export async function deleteTaskAction(id: number): Promise<void> {
  const me = await requireStaff();
  await db.delete(tasks).where(and(eq(tasks.id, id), eq(tasks.ownerId, Number(me.id))));
  revalidatePath("/dashboard");
}
