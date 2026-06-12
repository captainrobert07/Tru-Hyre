"use server";

import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { jobs, candidates, resumeFiles, stageHistory, submissions, notifications, users } from "@/db/schema";
import { uploadResume } from "@/lib/drive";
import { extractFields, pdfToText } from "@/lib/parse";
import { mergeParse, parseResumeWithAi } from "@/lib/parse-ai";
import { contentHash } from "@/lib/dedupe";
import { makeRefId } from "@/lib/refid";
import { isFeatureEnabled } from "@/lib/features";
import { logAudit } from "@/lib/audit";

const applySchema = z.object({
  jobId: z.coerce.number().int().positive(),
  fullName: z.string().min(2).max(200),
  email: z.string().email().max(254),
  phone: z.string().max(40).optional().or(z.literal("")),
  location: z.string().max(120).optional().or(z.literal("")),
  linkedinUrl: z.string().max(254).optional().or(z.literal("")),
  consent: z.string().optional(), // checkbox "on"
  // honeypot — bots fill hidden fields; humans don't.
  website: z.string().max(0).optional().or(z.literal("")),
});

export type ApplyResult = { ok: true } | { ok: false; error: string };

export async function applyToJobAction(_prev: ApplyResult | null, formData: FormData): Promise<ApplyResult> {
  if (!(await isFeatureEnabled("careers_page"))) return { ok: false, error: "Applications are closed." };

  const parsed = applySchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { ok: false, error: "Please fill in your name and a valid email." };
  const v = parsed.data;

  // Honeypot tripped → silently pretend success (don't tell the bot).
  if (v.website) return { ok: true };
  if (v.consent !== "on") return { ok: false, error: "Please consent to us processing your application." };

  const job = (await db.select().from(jobs).where(eq(jobs.id, v.jobId)))[0];
  if (!job || job.status !== "open") return { ok: false, error: "This role is no longer open." };

  // Resume file (optional but encouraged). Validate type/size.
  const file = formData.get("file");
  let drive: { driveFileId: string; webViewLink: string | null } | null = null;
  let fileMeta: { name: string; contentType: string; size: number } | null = null;
  let hash: string | null = null;
  let parsedSkills: string[] = [];
  let parsedSummary: string | null = null;

  if (file instanceof File && file.size > 0) {
    if (file.size > 10 * 1024 * 1024) return { ok: false, error: "Resume too large (max 10 MB)." };
    if (!/pdf/i.test(file.type) && !file.name.toLowerCase().endsWith(".pdf"))
      return { ok: false, error: "Please upload a PDF resume." };
    const buf = Buffer.from(await file.arrayBuffer());
    hash = contentHash(buf);
    try {
      const text = await pdfToText(buf);
      const base = extractFields(text);
      const ai = await parseResumeWithAi(text);
      const merged = mergeParse(base, ai);
      parsedSkills = merged.skills || [];
      parsedSummary = merged.summary;
    } catch {
      // parsing is best-effort for self-apply
    }
    drive = await uploadResume(buf, file.name, file.type || "application/pdf");
    fileMeta = { name: file.name, contentType: file.type || "application/pdf", size: file.size };
  }

  const refId = makeRefId();
  const [created] = await db
    .insert(candidates)
    .values({
      refId,
      fullName: v.fullName,
      email: v.email,
      phone: v.phone || null,
      location: v.location || null,
      linkedinUrl: v.linkedinUrl || null,
      skills: parsedSkills,
      summary: parsedSummary,
      stage: "hr_review",
      parseStatus: drive ? "ok" : "pending",
      source: "careers",
      sourceDetail: `Applied: ${job.title}`,
    })
    .returning({ id: candidates.id });

  if (drive && fileMeta) {
    await db.insert(resumeFiles).values({
      candidateId: created.id,
      driveFileId: drive.driveFileId,
      driveWebViewLink: drive.webViewLink,
      originalName: fileMeta.name,
      contentType: fileMeta.contentType,
      sizeBytes: fileMeta.size,
      contentHash: hash,
    });
  }

  await db.insert(stageHistory).values({
    candidateId: created.id,
    fromStage: null,
    toStage: "hr_review",
    note: `Self-applied via careers page to "${job.title}"`,
  });

  // Auto-create a submission to the applied job so it shows in the pipeline.
  await db.insert(submissions).values({
    candidateId: created.id,
    jobId: v.jobId,
    status: "submitted",
    notes: "Self-applied via careers page",
  });

  // Notify the job owner (or all staff if unowned) that a candidate applied.
  const recipients = job.ownerId
    ? [job.ownerId]
    : (await db.select({ id: users.id }).from(users).where(eq(users.role, "hr"))).map((u) => u.id);
  if (recipients.length) {
    await db.insert(notifications).values(
      recipients.map((userId) => ({
        userId,
        kind: "submission" as const,
        title: `New applicant: ${v.fullName}`,
        body: `Applied to ${job.title} via the careers page.`,
        url: `/candidates/${created.id}`,
      })),
    );
  }

  await logAudit({
    action: "create",
    targetType: "candidate",
    targetId: created.id,
    summary: `Careers self-apply: ${v.fullName} → ${job.title}`,
    meta: { refId, jobId: v.jobId, source: "careers" },
  });

  return { ok: true };
}
