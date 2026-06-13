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

function profileBlurb(c: { fullName: string; currentTitle: string | null; currentCompany: string | null; experienceYears: string | null; location: string | null; skills: string[] | null; summary: string | null }): string {
  return (
    `Name: ${c.fullName}\n` +
    `Title: ${c.currentTitle || "—"} at ${c.currentCompany || "—"}\n` +
    `Experience: ${c.experienceYears || "?"} years\n` +
    `Location: ${c.location || "—"}\n` +
    `Skills: ${(c.skills || []).join(", ") || "—"}\n` +
    `Summary: ${c.summary || "—"}`
  );
}

/** Draft a personalized outreach email. Returns text only (not sent). */
export async function generateOutreachAction(
  candidateId: number,
): Promise<{ ok: boolean; text?: string; error?: string }> {
  await requireStaff();
  await assertFeatureEnabled("ai_outreach");
  const c = (await db.select().from(candidates).where(eq(candidates.id, candidateId)))[0];
  if (!c) return { ok: false, error: "Candidate not found." };
  const text = await callText({
    system:
      "You are a recruiter writing a short, warm, personalized first-contact email to a candidate. " +
      "2-3 short paragraphs, reference their background specifically, end with a soft call to a quick chat. " +
      "No subject line, no placeholders like [Company] — use the facts given or omit. Plain text.",
    prompt: `${profileBlurb(c)}\n\nWrite the outreach email.`,
    maxTokens: 500,
  });
  if (!text) return { ok: false, error: "AI is unavailable (configure Anthropic under Integrations)." };
  return { ok: true, text };
}

/** Surface potential resume red-flags for recruiter review. Text only. */
export async function generateRedFlagsAction(
  candidateId: number,
): Promise<{ ok: boolean; text?: string; error?: string }> {
  await requireStaff();
  await assertFeatureEnabled("ai_redflags");
  const c = (await db.select().from(candidates).where(eq(candidates.id, candidateId)))[0];
  if (!c) return { ok: false, error: "Candidate not found." };
  const text = await callText({
    system:
      "You are a recruiter doing a quick risk scan of a candidate profile. List up to 5 potential concerns " +
      "(employment gaps, frequent job changes, title/experience mismatches, missing key skills, vague summary). " +
      "Be fair and factual — only flag what the data supports; if nothing stands out, say so. Use '- ' bullets, plain text.",
    prompt: `${profileBlurb(c)}\n\nList any red-flags for review.`,
    maxTokens: 500,
  });
  if (!text) return { ok: false, error: "AI is unavailable (configure Anthropic under Integrations)." };
  return { ok: true, text };
}
