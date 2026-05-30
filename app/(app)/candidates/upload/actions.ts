"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { candidates, resumeFiles, stageHistory } from "@/db/schema";
import { uploadResume } from "@/lib/blob";
import { parseResume } from "@/lib/parse";
import { contentHash, findDuplicates } from "@/lib/dedupe";
import { logAudit } from "@/lib/audit";
import { makeRefId } from "@/lib/refid";
import { requireStaff } from "@/lib/rbac";

export async function uploadResumeAction(formData: FormData): Promise<
  | { ok: false; error: string }
  | { ok: true; candidateId: number; duplicates: { reason: string; candidateId: number; fullName: string }[] }
> {
  const user = await requireStaff();
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Choose a PDF file." };
  if (file.size > 10 * 1024 * 1024) return { ok: false, error: "File too large (max 10 MB)." };
  if (!/pdf/i.test(file.type) && !file.name.toLowerCase().endsWith(".pdf"))
    return { ok: false, error: "Only PDF resumes are supported." };

  const buf = Buffer.from(await file.arrayBuffer());
  const hash = contentHash(buf);

  let parsed;
  let parseStatus: "ok" | "failed" = "ok";
  let parseError: string | null = null;
  try {
    parsed = await parseResume(buf);
  } catch (e) {
    parseStatus = "failed";
    parseError = (e as Error).message;
    parsed = {
      text: "",
      fullName: null,
      email: null,
      phone: null,
      location: null,
      currentTitle: null,
      currentCompany: null,
      summary: null,
      skills: [],
    };
  }

  const dupes = await findDuplicates({
    email: parsed.email,
    phone: parsed.phone,
    fullName: parsed.fullName,
    hash,
  });

  const blob = await uploadResume(buf, file.name, file.type || "application/pdf");

  const refId = makeRefId();
  const fullName = parsed.fullName || file.name.replace(/\.pdf$/i, "");

  const [created] = await db
    .insert(candidates)
    .values({
      refId,
      fullName,
      email: parsed.email,
      phone: parsed.phone,
      location: parsed.location,
      currentTitle: parsed.currentTitle,
      currentCompany: parsed.currentCompany,
      summary: parsed.summary,
      skills: parsed.skills,
      stage: "hr_review",
      parseStatus,
      parseError,
      uploadedById: Number(user.id),
    })
    .returning();

  await db.insert(resumeFiles).values({
    candidateId: created.id,
    blobUrl: blob.url,
    blobPathname: blob.pathname,
    originalName: file.name,
    contentType: file.type || "application/pdf",
    sizeBytes: file.size,
    contentHash: hash,
  });

  await db.insert(stageHistory).values({
    candidateId: created.id,
    fromStage: null,
    toStage: "hr_review",
    changedById: Number(user.id),
    note: `Resume uploaded${parseStatus === "failed" ? ` (parse failed: ${parseError})` : ""}.`,
  });

  await logAudit({
    actorId: Number(user.id),
    actorEmail: user.email,
    action: "create",
    targetType: "candidate",
    targetId: created.id,
    summary: `Uploaded resume for ${fullName}`,
    meta: { refId, parseStatus, dupes: dupes.length },
  });

  revalidatePath("/candidates");

  if (dupes.length > 0) {
    return {
      ok: true,
      candidateId: created.id,
      duplicates: dupes.map((d) => ({ reason: d.reason, candidateId: d.candidateId, fullName: d.fullName })),
    };
  }
  redirect(`/candidates/${created.id}`);
}
