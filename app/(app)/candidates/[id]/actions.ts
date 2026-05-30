"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { candidates, clientPackets, stageHistory, submissions } from "@/db/schema";
import { logAudit } from "@/lib/audit";
import { uploadPacket } from "@/lib/blob";
import { renderPacketPdf } from "@/lib/packet";
import { requireStaff } from "@/lib/rbac";

const editSchema = z.object({
  fullName: z.string().min(2).max(200),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().max(40).optional().or(z.literal("")),
  location: z.string().max(120).optional().or(z.literal("")),
  currentTitle: z.string().max(200).optional().or(z.literal("")),
  currentCompany: z.string().max(200).optional().or(z.literal("")),
  experienceYears: z.string().optional().or(z.literal("")),
  noticePeriodDays: z.string().optional().or(z.literal("")),
  currentCtc: z.string().optional().or(z.literal("")),
  expectedCtc: z.string().optional().or(z.literal("")),
  summary: z.string().max(2000).optional().or(z.literal("")),
  skillsCsv: z.string().max(800).optional().or(z.literal("")),
  notes: z.string().max(2000).optional().or(z.literal("")),
});

export async function updateCandidateAction(id: number, formData: FormData): Promise<{ ok: false; error: string } | void> {
  const user = await requireStaff();
  const raw = Object.fromEntries(formData.entries());
  const parsed = editSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Check the highlighted fields." };

  const v = parsed.data;
  const skills = (v.skillsCsv || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 50);

  await db
    .update(candidates)
    .set({
      fullName: v.fullName,
      email: v.email || null,
      phone: v.phone || null,
      location: v.location || null,
      currentTitle: v.currentTitle || null,
      currentCompany: v.currentCompany || null,
      experienceYears: v.experienceYears || null,
      noticePeriodDays: v.noticePeriodDays ? Number(v.noticePeriodDays) : null,
      currentCtc: v.currentCtc || null,
      expectedCtc: v.expectedCtc || null,
      summary: v.summary || null,
      skills,
      notes: v.notes || null,
      updatedAt: new Date(),
    })
    .where(eq(candidates.id, id));

  await logAudit({
    actorId: Number(user.id),
    actorEmail: user.email,
    action: "update",
    targetType: "candidate",
    targetId: id,
    summary: `Updated candidate ${v.fullName}`,
  });

  revalidatePath(`/candidates/${id}`);
  redirect(`/candidates/${id}`);
}

export async function setStageAction(id: number, toStage: string): Promise<void> {
  const user = await requireStaff();
  const allowed = ["received", "hr_review", "screening", "submitted", "shortlist", "interview", "hold", "offer", "joined", "rejected"] as const;
  if (!allowed.includes(toStage as typeof allowed[number])) return;

  const current = (await db.select({ stage: candidates.stage }).from(candidates).where(eq(candidates.id, id)))[0];
  if (!current) return;

  await db
    .update(candidates)
    .set({ stage: toStage as typeof allowed[number], updatedAt: new Date() })
    .where(eq(candidates.id, id));

  await db.insert(stageHistory).values({
    candidateId: id,
    fromStage: current.stage,
    toStage: toStage as typeof allowed[number],
    changedById: Number(user.id),
  });

  await logAudit({
    actorId: Number(user.id),
    actorEmail: user.email,
    action: "update",
    targetType: "candidate",
    targetId: id,
    summary: `Moved stage ${current.stage} → ${toStage}`,
  });

  revalidatePath(`/candidates/${id}`);
}

export async function generatePacketAction(id: number): Promise<{ ok: false; error: string } | { ok: true; url: string }> {
  const user = await requireStaff();
  const c = (await db.select().from(candidates).where(eq(candidates.id, id)))[0];
  if (!c) return { ok: false, error: "Candidate not found." };

  let pdf: Buffer;
  try {
    pdf = await renderPacketPdf({
      refId: c.refId,
      fullName: c.fullName,
      location: c.location,
      currentTitle: c.currentTitle,
      experienceYears: c.experienceYears,
      noticePeriodDays: c.noticePeriodDays,
      currentCtc: c.currentCtc,
      expectedCtc: c.expectedCtc,
      summary: c.summary,
      skills: c.skills || [],
    });
  } catch (e) {
    return { ok: false, error: `Packet render failed: ${(e as Error).message}` };
  }

  const blob = await uploadPacket(pdf, c.refId);
  await db.insert(clientPackets).values({
    candidateId: id,
    blobUrl: blob.url,
    blobPathname: blob.pathname,
    generatedById: Number(user.id),
  });

  await logAudit({
    actorId: Number(user.id),
    actorEmail: user.email,
    action: "create",
    targetType: "client_packet",
    targetId: id,
    summary: `Generated client packet for ${c.fullName}`,
  });

  revalidatePath(`/candidates/${id}`);
  return { ok: true, url: blob.url };
}

const submitSchema = z.object({
  jobId: z.coerce.number().int().positive(),
  notes: z.string().max(2000).optional(),
});

export async function submitToJobAction(id: number, formData: FormData): Promise<{ ok: false; error: string } | void> {
  const user = await requireStaff();
  const parsed = submitSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { ok: false, error: "Pick a job." };

  const c = (await db.select().from(candidates).where(eq(candidates.id, id)))[0];
  if (!c) return { ok: false, error: "Candidate not found." };

  const latestPacket = (
    await db.select().from(clientPackets).where(eq(clientPackets.candidateId, id)).orderBy(clientPackets.generatedAt)
  ).pop();

  if (!latestPacket) return { ok: false, error: "Generate a client packet first." };

  await db.insert(submissions).values({
    candidateId: id,
    jobId: parsed.data.jobId,
    packetId: latestPacket.id,
    submittedById: Number(user.id),
    status: "submitted",
    notes: parsed.data.notes || null,
  });

  await db
    .update(candidates)
    .set({ stage: "submitted", updatedAt: new Date() })
    .where(eq(candidates.id, id));

  await db.insert(stageHistory).values({
    candidateId: id,
    fromStage: c.stage,
    toStage: "submitted",
    changedById: Number(user.id),
    note: `Submitted to job ${parsed.data.jobId}`,
  });

  await logAudit({
    actorId: Number(user.id),
    actorEmail: user.email,
    action: "submit",
    targetType: "submission",
    targetId: id,
    summary: `Submitted ${c.fullName} to job #${parsed.data.jobId}`,
  });

  revalidatePath(`/candidates/${id}`);
  revalidatePath("/submissions");
  redirect(`/candidates/${id}`);
}
