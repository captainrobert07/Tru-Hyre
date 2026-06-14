"use server";

import { requireStaff } from "@/lib/rbac";
import { assertFeatureEnabled } from "@/lib/features";
import { callText } from "@/lib/ai";

/**
 * Draft a job description from the structured fields on the form. Pure text in,
 * pure text out — the client drops it into the description textarea.
 */
export async function generateJobDescriptionAction(input: {
  title: string;
  skills: string;
  location: string;
  workMode: string;
  experienceMin: string;
  experienceMax: string;
}): Promise<{ ok: boolean; text?: string; error?: string }> {
  await requireStaff();
  await assertFeatureEnabled("ai_jd");
  if (!input.title?.trim()) return { ok: false, error: "Enter a job title first." };

  const text = await callText({
    system:
      "You are a recruiter writing concise, inclusive job descriptions for an internal HR team. " +
      "Write 3 short sections: a one-paragraph role summary, 'What you'll do' (4-6 bullets), and " +
      "'What we're looking for' (4-6 bullets). No salary, no company boilerplate, no emoji. Plain text, " +
      "use '- ' for bullets.",
    prompt:
      `Title: ${input.title}\n` +
      `Skills: ${input.skills || "—"}\n` +
      `Location: ${input.location || "—"} (${input.workMode || "—"})\n` +
      `Experience: ${input.experienceMin || "?"}–${input.experienceMax || "?"} years\n\n` +
      `Write the job description.`,
    maxTokens: 900,
  });

  if (!text) return { ok: false, error: "AI is unavailable (no API key) or the request failed." };
  return { ok: true, text };
}

/**
 * Generate role-specific screening questions from the job fields.
 */
export async function generateScreeningQuestionsAction(input: {
  title: string;
  skills: string;
  experienceMin: string;
  experienceMax: string;
}): Promise<{ ok: boolean; text?: string; error?: string }> {
  await requireStaff();
  await assertFeatureEnabled("ai_screening");
  if (!input.title?.trim()) return { ok: false, error: "Enter a job title first." };

  const text = await callText({
    system:
      "You are a recruiter creating phone-screen questions. Produce 6-8 specific, role-relevant questions " +
      "that separate strong from weak candidates — mix technical depth, experience probes, and one or two " +
      "behavioural. Number them. Plain text only.",
    prompt:
      `Title: ${input.title}\n` +
      `Skills: ${input.skills || "—"}\n` +
      `Experience: ${input.experienceMin || "?"}–${input.experienceMax || "?"} years\n\n` +
      `Write the screening questions.`,
    maxTokens: 700,
  });

  if (!text) return { ok: false, error: "AI is unavailable (no API key) or the request failed." };
  return { ok: true, text };
}
