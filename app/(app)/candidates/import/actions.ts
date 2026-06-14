"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { candidates, stageHistory } from "@/db/schema";
import { logAudit } from "@/lib/audit";
import { makeRefId } from "@/lib/refid";
import { requireStaff } from "@/lib/rbac";
import { fireCandidateCreated } from "@/lib/webhooks";

export type ImportResult =
  | { ok: true; imported: number; skipped: number; errors: { row: number; reason: string }[] }
  | { ok: false; error: string };

/**
 * CSV import. Expects a header row with at least one of:
 *   fullName,email,phone,location,currentTitle,currentCompany,
 *   experienceYears,noticePeriodDays,currentCtc,expectedCtc,summary,
 *   skills (comma-separated within quotes),tags
 *
 * Unknown columns are silently ignored. Rows missing fullName are skipped.
 * Returns a summary suitable for toast display.
 */
export async function importCandidatesCsvAction(formData: FormData): Promise<ImportResult> {
  const me = await requireStaff();
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Pick a CSV file." };
  if (file.size > 5 * 1024 * 1024) return { ok: false, error: "File too large (max 5 MB)." };

  const text = await file.text();
  const rows = parseCsv(text);
  if (rows.length < 2) return { ok: false, error: "CSV needs a header row + at least one data row." };

  const headers = rows[0].map((h) => normalizeHeader(h));
  const data = rows.slice(1);

  let imported = 0;
  let skipped = 0;
  const errors: { row: number; reason: string }[] = [];

  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    const rec: Record<string, string> = {};
    headers.forEach((h, idx) => { rec[h] = (row[idx] ?? "").trim(); });

    const fullName = rec.fullname || rec.name || "";
    if (!fullName) {
      skipped++;
      errors.push({ row: i + 2, reason: "missing fullName" });
      continue;
    }

    const skills = (rec.skills || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const tags = (rec.tags || "")
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    const SOURCES = ["direct", "referral", "linkedin", "job_board", "agency", "careers", "other"] as const;
    const rawSource = (rec.source || "").toLowerCase().replace(/[\s-]+/g, "_");
    const source = (SOURCES as readonly string[]).includes(rawSource)
      ? (rawSource as typeof SOURCES[number])
      : "other"; // CSV imports default to 'other' rather than masquerading as direct HR uploads

    try {
      const refId = makeRefId();
      const [created] = await db
        .insert(candidates)
        .values({
          refId,
          fullName,
          email: rec.email || null,
          phone: rec.phone || null,
          location: rec.location || null,
          currentTitle: rec.currenttitle || rec.title || null,
          currentCompany: rec.currentcompany || rec.company || null,
          experienceYears: rec.experienceyears || rec.experience || null,
          noticePeriodDays: rec.noticeperioddays || rec.notice ? Number(rec.noticeperioddays || rec.notice) || null : null,
          currentCtc: rec.currentctc || null,
          expectedCtc: rec.expectedctc || null,
          summary: rec.summary || null,
          skills,
          tags,
          linkedinUrl: rec.linkedin || rec.linkedinurl || null,
          githubUrl: rec.github || rec.githuburl || null,
          source,
          sourceDetail: rec.sourcedetail || null,
          stage: "received",
          parseStatus: "ok",
          uploadedById: Number(me.id),
        })
        .returning({ id: candidates.id });

      await db.insert(stageHistory).values({
        candidateId: created.id,
        fromStage: null,
        toStage: "received",
        changedById: Number(me.id),
        note: "CSV import",
      });
      await fireCandidateCreated(created.id);
      imported++;
    } catch (e) {
      skipped++;
      errors.push({ row: i + 2, reason: (e as Error).message.slice(0, 120) });
    }
  }

  await logAudit({
    actorId: Number(me.id),
    actorEmail: me.email,
    action: "create",
    targetType: "candidate",
    summary: `CSV imported ${imported} candidates (${skipped} skipped)`,
    meta: { imported, skipped, errors: errors.slice(0, 20) },
  });

  revalidatePath("/candidates");
  return { ok: true, imported, skipped, errors: errors.slice(0, 20) };
}

function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().replace(/[\s_-]+/g, "");
}

/**
 * Tiny RFC-4180-ish CSV parser. Handles quoted fields, escaped quotes,
 * and CRLF line endings. Doesn't handle multi-line quoted cells (good
 * enough for spreadsheet exports).
 */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  const lines = text.replace(/\r\n/g, "\n").split("\n").filter((l) => l.length > 0);
  for (const line of lines) {
    rows.push(parseRow(line));
  }
  return rows;
}

function parseRow(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') { inQuotes = false; }
      else { cur += c; }
    } else {
      if (c === ',') { out.push(cur); cur = ""; }
      else if (c === '"') { inQuotes = true; }
      else { cur += c; }
    }
  }
  out.push(cur);
  return out;
}
