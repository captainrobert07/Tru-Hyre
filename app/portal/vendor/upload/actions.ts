"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { candidates, resumeFiles, stageHistory, users } from "@/db/schema";
import { uploadResume } from "@/lib/drive";
import { extractFields, pdfToText, type ParsedResume } from "@/lib/parse";
import { mergeParse, parseResumeWithAi } from "@/lib/parse-ai";
import { contentHash, findDuplicates } from "@/lib/dedupe";
import { logAudit } from "@/lib/audit";
import { makeRefId } from "@/lib/refid";
import { requireVendor } from "@/lib/rbac";
import { withToast } from "@/lib/toast";
import { fireCandidateCreated } from "@/lib/webhooks";

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

export async function vendorUploadResumeAction(formData: FormData): Promise<void> {
  const me = await requireVendor();
  // Look up the vendor's vendorAccountId
  const u = (await db.select().from(users).where(eq(users.id, Number(me.id))))[0];
  if (!u || !u.vendorAccountId) redirect("/portal/vendor?error=no_account");

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) redirect("/portal/vendor/upload?error=no_file");
  if (file.size > 10 * 1024 * 1024) redirect("/portal/vendor/upload?error=too_large");
  if (!/pdf/i.test(file.type) && !file.name.toLowerCase().endsWith(".pdf"))
    redirect("/portal/vendor/upload?error=not_pdf");

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

  // Dedupe (only against this vendor's own candidates? — no, full set so HR knows)
  const dupes = await findDuplicates({
    email: parsed.email,
    phone: parsed.phone,
    fullName: parsed.fullName,
    hash,
  });

  const drive = await uploadResume(buf, file.name, file.type || "application/pdf");
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
      experienceYears: parsed.experienceYears,
      noticePeriodDays: parsed.noticePeriodDays,
      currentCtc: parsed.currentCtc,
      expectedCtc: parsed.expectedCtc,
      summary: parsed.summary,
      skills: parsed.skills,
      linkedinUrl: parsed.linkedinUrl,
      githubUrl: parsed.githubUrl,
      stage: "received", // vendor uploads land in "received"; HR moves them
      parseStatus,
      parseError,
      uploadedById: Number(me.id),
      vendorAccountId: u.vendorAccountId,
    })
    .returning();

  await db.insert(resumeFiles).values({
    candidateId: created.id,
    driveFileId: drive.driveFileId,
    driveWebViewLink: drive.webViewLink,
    originalName: file.name,
    contentType: file.type || "application/pdf",
    sizeBytes: file.size,
    contentHash: hash,
  });

  await db.insert(stageHistory).values({
    candidateId: created.id,
    fromStage: null,
    toStage: "received",
    changedById: Number(me.id),
    note: `Vendor upload${parseStatus === "failed" ? ` (parse failed: ${parseError})` : ""}.`,
  });

  await logAudit({
    actorId: Number(me.id),
    actorEmail: me.email,
    action: "create",
    targetType: "candidate",
    targetId: created.id,
    summary: `Vendor uploaded ${fullName}`,
    meta: { refId, parseStatus, dupes: dupes.length, source: "vendor_portal" },
  });

  await fireCandidateCreated(created.id);

  revalidatePath("/portal/vendor");
  redirect(withToast("/portal/vendor", `Submitted ${fullName}${dupes.length > 0 ? ` (${dupes.length} possible dupes)` : ""}`));
}
