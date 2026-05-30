import Anthropic from "@anthropic-ai/sdk";
import type { ParsedResume } from "./parse";

const SYSTEM = `You extract structured candidate data from resume text. Reply ONLY by calling the extract_candidate tool. Be conservative: leave a field null if it isn't explicitly stated. For experienceYears, sum the work-history dates if there's no explicit total. For CTC, return absolute numbers (LPA -> *100000, lakhs -> *100000, crore -> *10000000, k -> *1000). For noticePeriodDays, convert weeks/months to days (1 week = 7, 1 month = 30). Skills should be specific tools/technologies/methodologies, not generic words.`;

const TOOL = {
  name: "extract_candidate",
  description: "Return the structured candidate profile.",
  input_schema: {
    type: "object" as const,
    properties: {
      fullName: { type: ["string", "null"] },
      email: { type: ["string", "null"] },
      phone: { type: ["string", "null"] },
      location: { type: ["string", "null"] },
      currentTitle: { type: ["string", "null"] },
      currentCompany: { type: ["string", "null"] },
      experienceYears: { type: ["number", "null"], description: "Total years of professional experience." },
      noticePeriodDays: { type: ["number", "null"] },
      currentCtc: { type: ["number", "null"], description: "Absolute number, no units." },
      expectedCtc: { type: ["number", "null"], description: "Absolute number, no units." },
      summary: { type: ["string", "null"], description: "Two to four sentences." },
      skills: { type: "array", items: { type: "string" } },
    },
    required: ["skills"],
    additionalProperties: false,
  },
};

const MODEL = process.env.ANTHROPIC_MODEL || "claude-haiku-4-5-20251001";

export type AiResume = Omit<ParsedResume, "text">;

export async function parseResumeWithAi(rawText: string): Promise<AiResume | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  if (!rawText || rawText.trim().length < 30) return null;

  const client = new Anthropic({ apiKey });
  try {
    const msg = await client.messages.create({
      model: MODEL,
      max_tokens: 1500,
      system: SYSTEM,
      tools: [TOOL],
      tool_choice: { type: "tool", name: "extract_candidate" },
      messages: [
        {
          role: "user",
          content: `Extract structured fields from this resume text. Return ONLY via the tool call.\n\n${rawText.slice(0, 30_000)}`,
        },
      ],
    });

    const toolUse = msg.content.find((c) => c.type === "tool_use");
    if (!toolUse || toolUse.type !== "tool_use") return null;
    const out = toolUse.input as Record<string, unknown>;

    const num = (k: string) => (typeof out[k] === "number" ? String(Math.round(out[k] as number)) : null);
    const numInt = (k: string) => (typeof out[k] === "number" ? Math.round(out[k] as number) : null);
    const str = (k: string) => (typeof out[k] === "string" ? (out[k] as string).trim() || null : null);
    const skills = Array.isArray(out.skills)
      ? (out.skills as unknown[]).filter((s): s is string => typeof s === "string").slice(0, 40)
      : [];

    return {
      fullName: str("fullName"),
      email: str("email"),
      phone: str("phone"),
      location: str("location"),
      currentTitle: str("currentTitle"),
      currentCompany: str("currentCompany"),
      experienceYears: num("experienceYears"),
      noticePeriodDays: numInt("noticePeriodDays"),
      currentCtc: num("currentCtc"),
      expectedCtc: num("expectedCtc"),
      summary: str("summary"),
      skills,
      // URL extraction stays in the regex layer; AI doesn't return them.
      linkedinUrl: null,
      githubUrl: null,
    };
  } catch (e) {
    console.error("[parse-ai] anthropic threw", (e as Error).message);
    return null;
  }
}

// Merge regex baseline with AI overrides; AI fills nulls and overrides only
// when its value is non-null (regex wins as a last-resort fallback).
export function mergeParse(base: ParsedResume, ai: AiResume | null): ParsedResume {
  if (!ai) return base;
  return {
    text: base.text,
    fullName: ai.fullName ?? base.fullName,
    email: ai.email ?? base.email,
    phone: ai.phone ?? base.phone,
    location: ai.location ?? base.location,
    currentTitle: ai.currentTitle ?? base.currentTitle,
    currentCompany: ai.currentCompany ?? base.currentCompany,
    experienceYears: ai.experienceYears ?? base.experienceYears,
    noticePeriodDays: ai.noticePeriodDays ?? base.noticePeriodDays,
    currentCtc: ai.currentCtc ?? base.currentCtc,
    expectedCtc: ai.expectedCtc ?? base.expectedCtc,
    summary: ai.summary ?? base.summary,
    skills: ai.skills.length > 0 ? Array.from(new Set([...ai.skills, ...base.skills])).slice(0, 40) : base.skills,
    linkedinUrl: base.linkedinUrl,
    githubUrl: base.githubUrl,
  };
}
