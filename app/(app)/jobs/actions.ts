"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { jobs, jobVendors } from "@/db/schema";
import { logAudit } from "@/lib/audit";
import { requireStaff } from "@/lib/rbac";
import { withToast } from "@/lib/toast";

const jobSchema = z.object({
  title: z.string().min(2).max(200),
  clientAccountId: z.coerce.number().int().positive(),
  status: z.enum(["open", "hold", "closing", "closed"]),
  priority: z.enum(["low", "normal", "high", "urgent"]),
  location: z.string().max(120).optional().or(z.literal("")),
  workMode: z.string().max(40).optional().or(z.literal("")),
  experienceMin: z.string().optional().or(z.literal("")),
  experienceMax: z.string().optional().or(z.literal("")),
  ctcMin: z.string().optional().or(z.literal("")),
  ctcMax: z.string().optional().or(z.literal("")),
  positions: z.coerce.number().int().positive().max(999),
  description: z.string().max(8000).optional().or(z.literal("")),
  skillsCsv: z.string().max(800).optional().or(z.literal("")),
  closeBy: z.string().optional().or(z.literal("")),
  vendorIdsCsv: z.string().optional().or(z.literal("")),
});

function parseSkills(csv: string | undefined) {
  return (csv || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 50);
}

function parseVendorIds(csv: string | undefined): number[] {
  return (csv || "")
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n) && n > 0);
}

export async function createJobAction(formData: FormData): Promise<void> {
  const user = await requireStaff();
  const parsed = jobSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) redirect("/jobs/new?error=invalid");

  const v = parsed.data;
  const [created] = await db
    .insert(jobs)
    .values({
      title: v.title,
      clientAccountId: v.clientAccountId,
      ownerId: Number(user.id),
      status: v.status,
      priority: v.priority,
      location: v.location || null,
      workMode: v.workMode || null,
      experienceMin: v.experienceMin || null,
      experienceMax: v.experienceMax || null,
      ctcMin: v.ctcMin || null,
      ctcMax: v.ctcMax || null,
      positions: v.positions,
      description: v.description || null,
      skills: parseSkills(v.skillsCsv),
      closeBy: v.closeBy || null,
    })
    .returning();

  const vendorIds = parseVendorIds(v.vendorIdsCsv);
  if (vendorIds.length > 0) {
    await db.insert(jobVendors).values(vendorIds.map((vid) => ({ jobId: created.id, vendorAccountId: vid })));
  }

  await logAudit({
    actorId: Number(user.id),
    actorEmail: user.email,
    action: "create",
    targetType: "job",
    targetId: created.id,
    summary: `Created job ${v.title}`,
  });

  revalidatePath("/jobs");
  redirect(withToast(`/jobs/${created.id}`, `Job "${v.title}" created`));
}

export async function updateJobAction(id: number, formData: FormData): Promise<void> {
  const user = await requireStaff();
  const parsed = jobSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) redirect(`/jobs/${id}/edit?error=invalid`);

  const v = parsed.data;
  await db
    .update(jobs)
    .set({
      title: v.title,
      clientAccountId: v.clientAccountId,
      status: v.status,
      priority: v.priority,
      location: v.location || null,
      workMode: v.workMode || null,
      experienceMin: v.experienceMin || null,
      experienceMax: v.experienceMax || null,
      ctcMin: v.ctcMin || null,
      ctcMax: v.ctcMax || null,
      positions: v.positions,
      description: v.description || null,
      skills: parseSkills(v.skillsCsv),
      closeBy: v.closeBy || null,
      updatedAt: new Date(),
    })
    .where(eq(jobs.id, id));

  const vendorIds = parseVendorIds(v.vendorIdsCsv);
  await db.delete(jobVendors).where(eq(jobVendors.jobId, id));
  if (vendorIds.length > 0) {
    await db.insert(jobVendors).values(vendorIds.map((vid) => ({ jobId: id, vendorAccountId: vid })));
  }

  await logAudit({
    actorId: Number(user.id),
    actorEmail: user.email,
    action: "update",
    targetType: "job",
    targetId: id,
    summary: `Updated job ${v.title}`,
  });

  revalidatePath(`/jobs/${id}`);
  revalidatePath("/jobs");
  redirect(withToast(`/jobs/${id}`, "Job updated"));
}

export async function deleteJobAction(id: number): Promise<void> {
  const user = await requireStaff();
  const j = (await db.select({ title: jobs.title }).from(jobs).where(eq(jobs.id, id)))[0];
  if (j) {
    await db.delete(jobs).where(eq(jobs.id, id));
    await logAudit({
      actorId: Number(user.id),
      actorEmail: user.email,
      action: "delete",
      targetType: "job",
      targetId: id,
      summary: `Deleted job ${j.title}`,
    });
  }
  revalidatePath("/jobs");
  redirect(withToast("/jobs", "Job deleted"));
}
