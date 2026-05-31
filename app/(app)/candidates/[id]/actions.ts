"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { candidates, clientPackets, stageHistory, submissions, resumeFiles, feedbackEvents } from "@/db/schema";
import { logAudit } from "@/lib/audit";
import { uploadPacket, deleteDriveFile } from "@/lib/drive";
import { renderPacketPdf } from "@/lib/packet";
import { requireAdmin, requireStaff } from "@/lib/rbac";
import { withToast } from "@/lib/toast";

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
  linkedinUrl: z.string().max(254).optional().or(z.literal("")),
  githubUrl: z.string().max(254).optional().or(z.literal("")),
  availableFrom: z.string().optional().or(z.literal("")),
  willingToRelocate: z.string().optional().or(z.literal("")),
  workAuthorization: z.string().max(120).optional().or(z.literal("")),
});

export async function updateCandidateAction(id: number, formData: FormData): Promise<void> {
  const user = await requireStaff();
  const raw = Object.fromEntries(formData.entries());
  const parsed = editSchema.safeParse(raw);
  if (!parsed.success) {
    redirect(`/candidates/${id}/edit?error=invalid`);
  }

  const v = parsed.data;
  const skills = (v.skillsCsv || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 50);

  // Coerce CTC fields through parseCtc so users can type "12L" / "1.5cr" / "120000"
  const currentCtcNum = v.currentCtc ? parseCtc(v.currentCtc) : null;
  const expectedCtcNum = v.expectedCtc ? parseCtc(v.expectedCtc) : null;

  let willingRelocate: boolean | null = null;
  if (v.willingToRelocate === "yes") willingRelocate = true;
  else if (v.willingToRelocate === "no") willingRelocate = false;

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
      currentCtc: currentCtcNum !== null ? String(currentCtcNum) : null,
      expectedCtc: expectedCtcNum !== null ? String(expectedCtcNum) : null,
      summary: v.summary || null,
      skills,
      notes: v.notes || null,
      linkedinUrl: v.linkedinUrl || null,
      githubUrl: v.githubUrl || null,
      availableFrom: v.availableFrom || null,
      willingToRelocate: willingRelocate,
      workAuthorization: v.workAuthorization || null,
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
  redirect(withToast(`/candidates/${id}`, "Candidate updated"));
}

const INLINE_FIELDS = [
  "fullName",
  "email",
  "phone",
  "location",
  "currentTitle",
  "currentCompany",
  "experienceYears",
  "noticePeriodDays",
  "currentCtc",
  "expectedCtc",
  "summary",
  "notes",
  "linkedinUrl",
  "githubUrl",
  "availableFrom",
  "willingToRelocate",
  "workAuthorization",
  "tagsCsv",
] as const;

const inlineSchema = z.object({
  field: z.enum(INLINE_FIELDS),
  value: z.string().max(2000),
});

export async function updateCandidateFieldAction(id: number, formData: FormData): Promise<void> {
  const user = await requireStaff();
  const parsed = inlineSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return;

  const { field, value } = parsed.data;
  const trimmed = value.trim();
  const v: string | null = trimmed === "" ? null : trimmed;

  const update: Partial<typeof candidates.$inferInsert> & { updatedAt: Date } = { updatedAt: new Date() };
  switch (field) {
    case "fullName": if (v === null || v.length < 2) return; update.fullName = v; break;
    case "email": update.email = v; break;
    case "phone": update.phone = v; break;
    case "location": update.location = v; break;
    case "currentTitle": update.currentTitle = v; break;
    case "currentCompany": update.currentCompany = v; break;
    case "summary": update.summary = v; break;
    case "notes": update.notes = v; break;
    case "linkedinUrl": update.linkedinUrl = v; break;
    case "githubUrl": update.githubUrl = v; break;
    case "workAuthorization": update.workAuthorization = v; break;
    case "experienceYears": {
      if (v === null) { update.experienceYears = null; break; }
      const n = Number(v);
      if (!Number.isFinite(n) || n < 0 || n > 60) return;
      update.experienceYears = String(n);
      break;
    }
    case "noticePeriodDays": {
      if (v === null) { update.noticePeriodDays = null; break; }
      const n = Number(v);
      if (!Number.isFinite(n) || n < 0 || n > 3650) return;
      update.noticePeriodDays = n;
      break;
    }
    case "currentCtc":
    case "expectedCtc": {
      if (v === null) {
        update[field] = null;
        break;
      }
      // Accept "12L", "1.2cr", "120k", "120000", "1,20,000"
      const numeric = parseCtc(v);
      if (numeric === null) return;
      update[field] = String(numeric);
      break;
    }
    case "availableFrom": {
      if (v === null) { update.availableFrom = null; break; }
      // Accept ISO date "YYYY-MM-DD" or anything Date can parse
      const d = new Date(v);
      if (Number.isNaN(d.getTime())) return;
      update.availableFrom = d.toISOString().slice(0, 10);
      break;
    }
    case "tagsCsv": {
      const tags = (v ?? "")
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean)
        .slice(0, 20);
      update.tags = tags;
      break;
    }
    case "willingToRelocate": {
      if (v === null) { update.willingToRelocate = null; break; }
      const lower = v.toLowerCase();
      if (["yes", "true", "y", "1"].includes(lower)) update.willingToRelocate = true;
      else if (["no", "false", "n", "0"].includes(lower)) update.willingToRelocate = false;
      else return;
      break;
    }
  }

  await db.update(candidates).set(update).where(eq(candidates.id, id));

  await logAudit({
    actorId: Number(user.id),
    actorEmail: user.email,
    action: "update",
    targetType: "candidate",
    targetId: id,
    summary: `Updated ${field}`,
    meta: { field, valueLength: trimmed.length },
  });

  revalidatePath(`/candidates/${id}`);
}

/**
 * Parse a user-typed compensation value into an absolute number.
 * Accepts "12L" / "12 lakhs" / "1.5cr" / "120k" / "120,000" / plain digits.
 * Returns null if the string can't be coerced to a positive finite number.
 */
function parseCtc(raw: string): number | null {
  const cleaned = raw.replace(/[,_\s]/g, "").toLowerCase();
  const m = cleaned.match(/^(\d+(?:\.\d+)?)(lpa|lakhs?|lac|crore|cr|k|m|million)?$/i);
  if (!m) return null;
  const n = Number(m[1]);
  if (!Number.isFinite(n) || n < 0) return null;
  const unit = (m[2] || "").toLowerCase();
  let scaled = n;
  if (unit === "lpa" || unit.startsWith("lakh") || unit === "lac") scaled = n * 100_000;
  else if (unit.startsWith("cr")) scaled = n * 10_000_000;
  else if (unit === "k") scaled = n * 1000;
  else if (unit.startsWith("m") || unit === "million") scaled = n * 1_000_000;
  if (scaled > 1e12) return null; // sanity cap
  return Math.round(scaled);
}

export async function setStageAction(
  id: number,
  toStage: string,
): Promise<{ ok: true; previousStage: string | null } | { ok: false; error: string }> {
  const user = await requireStaff();
  const allowed = ["received", "hr_review", "screening", "submitted", "shortlist", "interview", "hold", "offer", "joined", "rejected"] as const;
  if (!allowed.includes(toStage as typeof allowed[number])) return { ok: false, error: "Invalid stage" };

  const current = (await db.select({ stage: candidates.stage }).from(candidates).where(eq(candidates.id, id)))[0];
  if (!current) return { ok: false, error: "Candidate not found" };
  if (current.stage === toStage) return { ok: true, previousStage: current.stage };

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
  return { ok: true, previousStage: current.stage };
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

  const drive = await uploadPacket(pdf, c.refId);
  await db.insert(clientPackets).values({
    candidateId: id,
    driveFileId: drive.driveFileId,
    driveWebViewLink: drive.webViewLink,
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
  return { ok: true, fileId: drive.driveFileId };
}

const submitSchema = z.object({
  jobId: z.coerce.number().int().positive(),
  notes: z.string().max(2000).optional(),
});

export async function submitToJobAction(id: number, formData: FormData): Promise<void> {
  const user = await requireStaff();
  const parsed = submitSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    redirect(`/candidates/${id}?error=invalid_job`);
  }

  const c = (await db.select().from(candidates).where(eq(candidates.id, id)))[0];
  if (!c) {
    redirect(`/candidates/${id}?error=not_found`);
  }

  const latestPacket = (
    await db.select().from(clientPackets).where(eq(clientPackets.candidateId, id)).orderBy(clientPackets.generatedAt)
  ).pop();

  if (!latestPacket) {
    redirect(`/candidates/${id}?error=packet_required`);
  }

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
  redirect(withToast(`/candidates/${id}`, `Submitted to job #${parsed.data.jobId}`));
}

// ---------- GDPR / compliance ----------

/**
 * Hard-delete a candidate and every artifact attached to them.
 * Admin-only because it's irreversible. Removes:
 *   - candidate row (cascades to stage_history, submissions, feedback_events)
 *   - resume blobs (real files on Vercel Blob)
 *   - client packet blobs
 * Audit-logged with the candidate's ref id + name + email so the
 * compliance trail survives the delete.
 */
export async function deleteCandidateAction(id: number): Promise<void> {
  const user = await requireAdmin();
  const c = (await db.select().from(candidates).where(eq(candidates.id, id)))[0];
  if (!c) redirect("/candidates");

  const [resumes, packets] = await Promise.all([
    db.select().from(resumeFiles).where(eq(resumeFiles.candidateId, id)),
    db.select().from(clientPackets).where(eq(clientPackets.candidateId, id)),
  ]);

  // Best-effort Drive deletion. Don't block the SQL purge if a file is gone,
  // but record every failure in the audit meta so compliance can re-attempt.
  const blobErrors: { url: string; reason: string }[] = [];
  let blobsDeleted = 0;
  for (const r of resumes) {
    try {
      await deleteDriveFile(r.driveFileId);
      blobsDeleted++;
    } catch (e) {
      blobErrors.push({ url: r.driveFileId, reason: (e as Error).message || "unknown" });
    }
  }
  for (const p of packets) {
    try {
      await deleteDriveFile(p.driveFileId);
      blobsDeleted++;
    } catch (e) {
      blobErrors.push({ url: p.driveFileId, reason: (e as Error).message || "unknown" });
    }
  }

  // Cascading FKs handle stage_history, submissions, feedback_events,
  // resume_files, client_packets.
  await db.delete(candidates).where(eq(candidates.id, id));

  await logAudit({
    actorId: Number(user.id),
    actorEmail: user.email,
    action: "delete",
    targetType: "candidate",
    targetId: id,
    summary: `GDPR-deleted candidate ${c.fullName}${blobErrors.length > 0 ? ` (${blobErrors.length} blob errors)` : ""}`,
    meta: {
      refId: c.refId,
      email: c.email,
      blobsAttempted: resumes.length + packets.length,
      blobsDeleted,
      blobErrors: blobErrors.length > 0 ? blobErrors : undefined,
    },
  });

  revalidatePath("/candidates");
  redirect(withToast("/candidates", `Deleted ${c.fullName}`));
}

/**
 * Export everything we have on a candidate as JSON. Used for
 * GDPR data-subject-access requests. Admin-only.
 */
export async function exportCandidateData(id: number): Promise<Record<string, unknown> | null> {
  const user = await requireAdmin();
  const c = (await db.select().from(candidates).where(eq(candidates.id, id)))[0];
  if (!c) return null;

  const [resumes, packets, history, subs] = await Promise.all([
    db.select().from(resumeFiles).where(eq(resumeFiles.candidateId, id)),
    db.select().from(clientPackets).where(eq(clientPackets.candidateId, id)),
    db.select().from(stageHistory).where(eq(stageHistory.candidateId, id)),
    db.select().from(submissions).where(eq(submissions.candidateId, id)),
  ]);

  const subIds = subs.map((s) => s.id);
  const feedback = subIds.length === 0
    ? []
    : await db.select().from(feedbackEvents).where(eq(feedbackEvents.submissionId, subIds[0]));

  await logAudit({
    actorId: Number(user.id),
    actorEmail: user.email,
    action: "download",
    targetType: "candidate",
    targetId: id,
    summary: `Exported full data for ${c.fullName}`,
    meta: { refId: c.refId },
  });

  return {
    exportedAt: new Date().toISOString(),
    exportedBy: user.email,
    candidate: c,
    resumeFiles: resumes,
    clientPackets: packets,
    stageHistory: history,
    submissions: subs,
    feedbackEvents: feedback,
  };
}
