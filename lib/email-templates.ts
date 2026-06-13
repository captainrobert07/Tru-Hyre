export type TemplateContext = {
  candidate: {
    fullName: string;
    firstName: string;
    email: string;
    refId: string;
  };
  stage: { from: string; to: string };
  recruiter: { fullName: string; email: string };
  job: { title: string };
  appName: string;
};

const TOKEN = /\{\{\s*([a-zA-Z][a-zA-Z0-9_.]*)\s*\}\}/g;

function lookup(ctx: TemplateContext, path: string): string | undefined {
  const parts = path.split(".");
  let cur: unknown = ctx;
  for (const p of parts) {
    if (cur && typeof cur === "object" && p in (cur as Record<string, unknown>)) {
      cur = (cur as Record<string, unknown>)[p];
    } else {
      return undefined;
    }
  }
  if (cur === null || cur === undefined) return undefined;
  return String(cur);
}

const HTML_ENTITIES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

function htmlEscape(s: string): string {
  return s.replace(/[&<>"']/g, (c) => HTML_ENTITIES[c] || c);
}

export function renderTemplate(template: string, ctx: TemplateContext, mode: "html" | "text"): string {
  return template.replace(TOKEN, (_match, key: string) => {
    const value = lookup(ctx, key);
    if (value === undefined) {
      console.warn(`[email-template] unknown token {{${key}}}`);
      return "";
    }
    return mode === "html" ? htmlEscape(value) : value;
  });
}

/** First word of a full name (falls back to the whole string). */
export function firstName(fullName: string): string {
  return fullName.split(/\s+/)[0] || fullName;
}

/**
 * Resolve the outbound "From" address. NOTE: lib/email.ts resolves the From
 * header from the Gmail integration config; this env-only helper is a fallback
 * for callers that build a TemplateContext.recruiter.email default.
 */
export function defaultFromAddress(): string {
  return process.env.EMAIL_FROM || process.env.GMAIL_USER || "noreply@truhyre.app";
}

/** Build a TemplateContext with sensible defaults for unused fields. */
export function buildTemplateContext(input: {
  candidate: { fullName: string; email: string; refId: string };
  appName: string;
  stageFrom?: string;
  stageTo?: string;
  recruiter?: { fullName: string; email: string };
  jobTitle?: string;
}): TemplateContext {
  return {
    candidate: {
      fullName: input.candidate.fullName,
      firstName: firstName(input.candidate.fullName),
      email: input.candidate.email,
      refId: input.candidate.refId,
    },
    stage: { from: input.stageFrom || "", to: input.stageTo || "" },
    recruiter: input.recruiter || { fullName: input.appName, email: defaultFromAddress() },
    job: { title: input.jobTitle || "" },
    appName: input.appName,
  };
}

export function sampleContext(appName: string): TemplateContext {
  return {
    candidate: {
      fullName: "Priya Sharma",
      firstName: "Priya",
      email: "priya.sharma@example.com",
      refId: "C-2026-001",
    },
    stage: { from: "screening", to: "interview" },
    recruiter: { fullName: "Sarah HR", email: "sarah@example.com" },
    job: { title: "Senior Backend Engineer" },
    appName,
  };
}

export const TEMPLATE_VARIABLES: Array<{ token: string; description: string }> = [
  { token: "{{candidate.fullName}}", description: "Candidate's full name" },
  { token: "{{candidate.firstName}}", description: "Candidate's first name only" },
  { token: "{{candidate.email}}", description: "Candidate's email" },
  { token: "{{candidate.refId}}", description: "Internal reference ID (e.g. C-2026-001)" },
  { token: "{{stage.from}}", description: "Previous stage (e.g. screening)" },
  { token: "{{stage.to}}", description: "New stage (e.g. interview)" },
  { token: "{{recruiter.fullName}}", description: "Recruiter who triggered the change" },
  { token: "{{recruiter.email}}", description: "Recruiter's email" },
  { token: "{{job.title}}", description: "Job title (when known)" },
  { token: "{{appName}}", description: "Tru Hyre" },
];
