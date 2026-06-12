"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { candidates } from "@/db/schema";
import { requireStaff } from "@/lib/rbac";
import { assertFeatureEnabled } from "@/lib/features";
import { callText } from "@/lib/ai";
import { logAudit } from "@/lib/audit";

/**
 * Generate a concise recruiter-facing summary from the candidate's structured
 * fields (and a resume snippet if present), then save it to candidates.summary.
 */
export async function generateCandidateSummaryAction(
  candidateId: number,
): Promise<{ ok: boolean; summary?: string; error?: string }> {
  const user = await requireStaff();
  await assertFeatureEnabled("ai_summary");

  const c = (await db.select().from(candidates).where(eq(candidates.id, candidateId)))[0];
  if (!c) return { ok: false, error: "Candidate not found." };

  const profile =
    `Name: ${c.fullName}\n` +
    `Title: ${c.currentTitle || "—"} at ${c.currentCompany || "—"}\n` +
    `Experience: ${c.experienceYears || "?"} years\n` +
    `Location: ${c.location || "—"}\n` +
    `Skills: ${(c.skills || []).join(", ") || "—"}\n` +
    `Current summary: ${c.summary || "—"}`;

  const summary = await callText({
    system:
      "You are a recruiter writing a 2-4 sentence internal summary of a candidate for a hiring manager. " +
      "Be specific and factual using only the data given — do not invent employers, dates, or skills. " +
      "Lead with seniority + domain, then standout strengths. Plain text, no preamble.",
    prompt: `${profile}\n\nWrite the summary.`,
    maxTokens: 400,
  });

  if (!summary) return { ok: false, error: "AI is unavailable (no API key) or the request failed." };

  await db.update(candidates).set({ summary, updatedAt: new Date() }).where(eq(candidates.id, candidateId));
  await logAudit({
    actorId: Number(user.id),
    actorEmail: user.email,
    action: "update",
    targetType: "candidate",
    targetId: candidateId,
    summary: `AI-generated summary for ${c.fullName}`,
    meta: { field: "summary", ai: true },
  });

  revalidatePath(`/candidates/${candidateId}`);
  return { ok: true, summary };
}
