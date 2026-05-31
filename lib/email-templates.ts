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
