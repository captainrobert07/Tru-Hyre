"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { candidates, resumeFiles, stageHistory } from "@/db/schema";
import { uploadResume, type DriveUploadResult } from "@/lib/drive";
import { extractFields, pdfToText, type ParsedResume } from "@/lib/parse";
import { mergeParse, parseResumeWithAi } from "@/lib/parse-ai";
import { contentHash, findDuplicates } from "@/lib/dedupe";
import { logAudit } from "@/lib/audit";
import { makeRefId } from "@/lib/refid";
import { requireStaffOrLite } from "@/lib/rbac";

type UploadResult =
  | { ok: false; error: string }
  | { ok: true; candidateId: number; duplicates: { reason: string; candidateId: number; fullName: string }[] };

const EMPTY: ParsedResume = {
  text: "",
  fullName: null,
  email: null,
  phone: null,
  location: null,
  currentTitle: null,
  currentCompany: null,
  experienceYears: null,
  noticePeriodDays: null,
  currentCtc: null,
  expectedCtc: null,
  summary: null,
  skills: [],
  linkedinUrl: null,
  githubUrl: null,
};

type CandidateSource = "direct" | "referral" | "linkedin" | "job_board" | "agency" | "careers" | "other";
const SOURCE_VALUES: CandidateSource[] = ["direct", "referral", "linkedin", "job_board", "agency", "careers", "other"];

function coerceSource(raw: FormDataEntryValue | null): CandidateSource {
  const s = typeof raw === "string" ? raw : "";
  return (SOURCE_VALUES as string[]).includes(s) ? (s as CandidateSource) : "direct";
}

async function persistCandidate({
  parsed,
  parseStatus,
  parseError,
  drive,
  fileMeta,
  hash,
  fallbackName,
  source,
  sourceDetail,
  user,
}: {
  parsed: ParsedResume;
  parseStatus: "ok" | "failed";
  parseError: string | null;
  drive: DriveUploadResult | null;
  fileMeta: { name: string; contentType: string; size: number } | null;
  hash: string | null;
  fallbackName: string;
  source: CandidateSource;
  sourceDetail: string | null;
  user: { id: string; email: string };
}): Promise<UploadResult> {
  const dupes = await findDuplicates({
    email: parsed.email,
    phone: parsed.phone,
    fullName: parsed.fullName,
    hash,
  });

  const refId = makeRefId();
  const fullName = parsed.fullName || fallbackName;

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
      experienceYears: parsed.experienceYears,
      noticePeriodDays: parsed.noticePeriodDays,
      currentCtc: parsed.currentCtc,
      expectedCtc: parsed.expectedCtc,
      summary: parsed.summary,
      skills: parsed.skills,
      linkedinUrl: parsed.linkedinUrl,
      githubUrl: parsed.githubUrl,
      stage: "hr_review",
      parseStatus,
      parseError,
      source,
      sourceDetail,
      uploadedById: Number(user.id),
    })
    .returning();

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
    changedById: Number(user.id),
    note: `Resume ${drive ? "uploaded" : "pasted"}${parseStatus === "failed" ? ` (parse failed: ${parseError})` : ""}.`,
  });

  await logAudit({
    actorId: Number(user.id),
    actorEmail: user.email,
    action: "create",
    targetType: "candidate",
    targetId: created.id,
    summary: `Created candidate ${fullName}`,
    meta: { refId, parseStatus, dupes: dupes.length, source, channel: drive ? "pdf" : "paste" },
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

type BulkUploadResult =
  | { ok: false; error: string }
  | { ok: true; created: number; failed: number; errors: string[] };

/**
 * Bulk resume upload: process up to 50 PDFs in one go. Each file runs the same
 * parse → Drive → persist path as a single upload; failures are collected so
 * one bad file doesn't abort the batch. Returns a summary (no redirect).
 */
export async function bulkUploadResumesAction(_prev: BulkUploadResult | null, formData: FormData): Promise<BulkUploadResult> {
  const user = await requireStaffOrLite();
  const files = formData.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length === 0) return { ok: false, error: "Choose one or more PDF files." };
  if (files.length > 50) return { ok: false, error: "Max 50 files per batch." };

  const source = coerceSource(formData.get("source"));
  let created = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const file of files) {
    try {
      if (file.size > 10 * 1024 * 1024) { failed++; errors.push(`${file.name}: too large`); continue; }
      if (!/pdf/i.test(file.type) && !file.name.toLowerCase().endsWith(".pdf")) { failed++; errors.push(`${file.name}: not a PDF`); continue; }
      const buf = Buffer.from(await file.arrayBuffer());
      const hash = contentHash(buf);
      let parsed: ParsedResume = EMPTY;
      let parseStatus: "ok" | "failed" = "ok";
      let parseError: string | null = null;
      try {
        const text = await pdfToText(buf);
        const base = extractFields(text);
        const ai = await parseResumeWithAi(text);
        parsed = mergeParse(base, ai);
      } catch (e) {
        parseStatus = "failed";
        parseError = (e as Error).message;
      }
      const drive = await uploadResume(buf, file.name, file.type || "application/pdf");
      const refId = makeRefId();
      const [createdRow] = await db.insert(candidates).values({
        refId,
        fullName: parsed.fullName || file.name.replace(/\.pdf$/i, ""),
        email: parsed.email, phone: parsed.phone, location: parsed.location,
        currentTitle: parsed.currentTitle, currentCompany: parsed.currentCompany,
        experienceYears: parsed.experienceYears, noticePeriodDays: parsed.noticePeriodDays,
        currentCtc: parsed.currentCtc, expectedCtc: parsed.expectedCtc,
        summary: parsed.summary, skills: parsed.skills,
        linkedinUrl: parsed.linkedinUrl, githubUrl: parsed.githubUrl,
        stage: "hr_review", parseStatus, parseError, source,
        uploadedById: Number(user.id),
      }).returning({ id: candidates.id });
      await db.insert(resumeFiles).values({
        candidateId: createdRow.id, driveFileId: drive.driveFileId, driveWebViewLink: drive.webViewLink,
        originalName: file.name, contentType: file.type || "application/pdf", sizeBytes: file.size, contentHash: hash,
      });
      await db.insert(stageHistory).values({ candidateId: createdRow.id, fromStage: null, toStage: "hr_review", changedById: Number(user.id), note: "Bulk upload" });
      created++;
    } catch (e) {
      failed++;
      errors.push(`${file.name}: ${(e as Error).message.slice(0, 80)}`);
    }
  }

  await logAudit({
    actorId: Number(user.id), actorEmail: user.email, action: "create", targetType: "candidate",
    summary: `Bulk uploaded ${created} resumes (${failed} failed)`, meta: { created, failed },
  });
  revalidatePath("/candidates");
  return { ok: true, created, failed, errors: errors.slice(0, 20) };
}

export async function uploadResumeAction(_prev: UploadResult | null, formData: FormData): Promise<UploadResult> {
  const user = await requireStaffOrLite();
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Choose a PDF file." };
  if (file.size > 10 * 1024 * 1024) return { ok: false, error: "File too large (max 10 MB)." };
  if (!/pdf/i.test(file.type) && !file.name.toLowerCase().endsWith(".pdf"))
    return { ok: false, error: "Only PDF resumes are supported." };

  const buf = Buffer.from(await file.arrayBuffer());
  const hash = contentHash(buf);

  let parsed: ParsedResume = EMPTY;
  let parseStatus: "ok" | "failed" = "ok";
  let parseError: string | null = null;
  try {
    const text = await pdfToText(buf);
    const base = extractFields(text);
    const ai = await parseResumeWithAi(text);
    parsed = mergeParse(base, ai);
  } catch (e) {
    parseStatus = "failed";
    parseError = (e as Error).message;
  }

  const drive = await uploadResume(buf, file.name, file.type || "application/pdf");

  applyLinkOverrides(parsed, formData);

  return persistCandidate({
    parsed,
    parseStatus,
    parseError,
    drive,
    fileMeta: { name: file.name, contentType: file.type || "application/pdf", size: file.size },
    hash,
    fallbackName: file.name.replace(/\.pdf$/i, ""),
    source: coerceSource(formData.get("source")),
    sourceDetail: ((formData.get("sourceDetail") as string) || "").trim().slice(0, 160) || null,
    user,
  });
}

// A manually-entered LinkedIn/GitHub URL on the upload form overrides whatever
// the parser found (or fills it when the parser found nothing).
function applyLinkOverrides(parsed: ParsedResume, formData: FormData): void {
  const li = ((formData.get("linkedinUrl") as string) || "").trim();
  const gh = ((formData.get("githubUrl") as string) || "").trim();
  if (li) parsed.linkedinUrl = li.slice(0, 254);
  if (gh) parsed.githubUrl = gh.slice(0, 254);
}

export async function pasteResumeAction(_prev: UploadResult | null, formData: FormData): Promise<UploadResult> {
  const user = await requireStaffOrLite();
  const text = ((formData.get("text") as string) || "").trim();
  if (text.length < 30) return { ok: false, error: "Paste the resume text (at least 30 characters)." };
  if (text.length > 200_000) return { ok: false, error: "Text too long (max 200 KB)." };

  let parsed: ParsedResume;
  try {
    const base = extractFields(text);
    const ai = await parseResumeWithAi(text);
    parsed = mergeParse(base, ai);
  } catch (e) {
    return { ok: false, error: `Parse failed: ${(e as Error).message}` };
  }

  applyLinkOverrides(parsed, formData);

  return persistCandidate({
    parsed,
    parseStatus: "ok",
    parseError: null,
    drive: null,
    fileMeta: null,
    hash: null,
    fallbackName: parsed.fullName || "Pasted candidate",
    source: coerceSource(formData.get("source")),
    sourceDetail: ((formData.get("sourceDetail") as string) || "").trim().slice(0, 160) || null,
    user,
  });
}
