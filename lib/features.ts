import { db } from "@/db";
import { featureFlags } from "@/db/schema";

/**
 * Feature-flag registry. The catalogue below is the source of truth for which
 * optional features EXIST and their metadata; the on/off state is persisted in
 * the `feature_flags` table (a missing row means "use defaultEnabled").
 *
 * To make a new feature toggleable: add an entry here, then guard its UI entry
 * point with `isFeatureEnabled(key)` and its server action with
 * `assertFeatureEnabled(key)`.
 */

export type FeatureKey =
  | "interviews"
  | "scorecards"
  | "email_composer"
  | "source_tracking"
  | "inbox"
  | "sla_alerts"
  | "command_palette"
  | "ai_match"
  | "ai_summary"
  | "ai_jd"
  | "ai_screening"
  | "ai_search"
  | "ai_dedupe"
  | "careers_page"
  | "referral_portal"
  | "linkedin_import"
  | "talent_pool"
  | "offers"
  | "requisition_approval"
  | "interview_reminders"
  | "self_scheduling"
  | "bulk_actions"
  | "bulk_email"
  | "email_sequences"
  | "sms_notifications"
  | "gmail_sync"
  | "analytics_reports"
  | "scheduled_digest"
  | "diversity_reporting"
  | "activity_feed"
  | "saved_view_sharing"
  | "webhooks"
  | "public_api"
  | "gdpr_tools";

export type FeatureCategory = "Scheduling" | "Communication" | "Sourcing" | "Productivity" | "AI" | "Pipeline" | "Analytics" | "Platform";

export type FeatureDef = {
  key: FeatureKey;
  label: string;
  description: string;
  category: FeatureCategory;
  defaultEnabled: boolean;
};

export const FEATURES: FeatureDef[] = [
  {
    key: "interviews",
    label: "Interview scheduling",
    description: "Schedule interviews from a candidate, create Google Calendar events with Meet links, and email invites.",
    category: "Scheduling",
    defaultEnabled: true,
  },
  {
    key: "scorecards",
    label: "Interview scorecards",
    description: "Structured 1–5 ratings and a hire verdict per interviewer, aggregated on the candidate.",
    category: "Scheduling",
    defaultEnabled: true,
  },
  {
    key: "email_composer",
    label: "Ad-hoc email composer",
    description: "Send a templated or custom email to a candidate from their profile, logged to the communication timeline.",
    category: "Communication",
    defaultEnabled: true,
  },
  {
    key: "source_tracking",
    label: "Source attribution",
    description: "Capture how each candidate entered (referral, LinkedIn, agency, careers…) and report source effectiveness.",
    category: "Sourcing",
    defaultEnabled: true,
  },
  {
    key: "inbox",
    label: "Recruiter inbox",
    description: "A personal /inbox of everything that needs you: tasks, idle candidates, stale submissions, upcoming interviews.",
    category: "Productivity",
    defaultEnabled: true,
  },
  {
    key: "sla_alerts",
    label: "SLA aging alerts",
    description: "A daily job that creates reminder tasks for idle candidates, stale feedback, and overdue interviews.",
    category: "Productivity",
    defaultEnabled: true,
  },
  {
    key: "command_palette",
    label: "Command palette (⌘K)",
    description: "Quick keyboard navigation and search across candidates, jobs, clients, and vendors.",
    category: "Productivity",
    defaultEnabled: true,
  },
  {
    key: "ai_match",
    label: "AI candidate–job match scoring",
    description: "Rank candidates for a job 0–100 with match reasons, using a SQL prefilter then Claude on the shortlist.",
    category: "AI",
    defaultEnabled: true,
  },
  {
    key: "ai_summary",
    label: "AI candidate summary",
    description: "Generate a concise recruiter-facing summary and highlights for a candidate from their profile.",
    category: "AI",
    defaultEnabled: true,
  },
  {
    key: "ai_jd",
    label: "AI job-description generator",
    description: "Draft a job description from the title, skills, and parameters on the job form.",
    category: "AI",
    defaultEnabled: true,
  },
  {
    key: "ai_screening",
    label: "AI screening questions",
    description: "Generate role-specific screening questions for a job.",
    category: "AI",
    defaultEnabled: true,
  },
  {
    key: "ai_search",
    label: "AI semantic candidate search",
    description: "Search candidates with a natural-language query; Claude turns it into structured filters.",
    category: "AI",
    defaultEnabled: true,
  },
  {
    key: "ai_dedupe",
    label: "AI duplicate suggestions",
    description: "Surface likely duplicate candidates beyond exact email/phone matches, for review.",
    category: "AI",
    defaultEnabled: true,
  },
  {
    key: "careers_page",
    label: "Public careers page",
    description: "A public /careers listing of open jobs with a self-apply form that feeds the candidate pipeline.",
    category: "Sourcing",
    defaultEnabled: true,
  },
  {
    key: "referral_portal",
    label: "Employee referrals",
    description: "Let staff submit referrals from a /refer link; referred candidates enter tagged as referrals.",
    category: "Sourcing",
    defaultEnabled: true,
  },
  {
    key: "linkedin_import",
    label: "Profile URL import",
    description: "Paste a LinkedIn/profile URL on upload to prefill the candidate's links.",
    category: "Sourcing",
    defaultEnabled: true,
  },
  {
    key: "talent_pool",
    label: "Talent pool tagging",
    description: "Tag and re-engage past candidates (silver medalists) as a searchable talent pool.",
    category: "Sourcing",
    defaultEnabled: true,
  },
  {
    key: "offers",
    label: "Offer management",
    description: "Record offers (comp, dates, status) on a candidate and track accept/decline outcomes.",
    category: "Pipeline",
    defaultEnabled: true,
  },
  {
    key: "requisition_approval",
    label: "Requisition approval",
    description: "New jobs start as drafts needing admin approval before they go open.",
    category: "Pipeline",
    defaultEnabled: false,
  },
  {
    key: "interview_reminders",
    label: "Interview reminders",
    description: "The daily SLA job reminds interviewers about interviews happening that day.",
    category: "Pipeline",
    defaultEnabled: true,
  },
  {
    key: "self_scheduling",
    label: "Candidate self-scheduling",
    description: "Generate a link a candidate can use to request an interview slot.",
    category: "Pipeline",
    defaultEnabled: false,
  },
  {
    key: "bulk_actions",
    label: "Extended bulk actions",
    description: "Bulk stage-change and tag candidates from the candidates list.",
    category: "Pipeline",
    defaultEnabled: true,
  },
  {
    key: "bulk_email",
    label: "Bulk email to segments",
    description: "Email a templated message to a selected set of candidates at once.",
    category: "Communication",
    defaultEnabled: true,
  },
  {
    key: "email_sequences",
    label: "Email sequences (drip)",
    description: "Enroll candidates in a multi-step email sequence; steps send on schedule via the daily job.",
    category: "Communication",
    defaultEnabled: false,
  },
  {
    key: "sms_notifications",
    label: "SMS / WhatsApp notifications",
    description: "Send stage-change texts via an SMS provider. Requires SMS provider credentials to actually send.",
    category: "Communication",
    defaultEnabled: false,
  },
  {
    key: "gmail_sync",
    label: "Two-way email sync",
    description: "Log inbound candidate replies into the communication timeline. Full Gmail/IMAP sync requires external setup.",
    category: "Communication",
    defaultEnabled: false,
  },
  {
    key: "analytics_reports",
    label: "Reports & analytics",
    description: "The Reports page: funnel conversion, cycle time, vendor scorecard, recruiter productivity, forecasting.",
    category: "Analytics",
    defaultEnabled: true,
  },
  {
    key: "scheduled_digest",
    label: "Weekly report digest",
    description: "Email a weekly pipeline digest to staff via the daily job (sends on Mondays).",
    category: "Analytics",
    defaultEnabled: false,
  },
  {
    key: "diversity_reporting",
    label: "Diversity / EEO reporting",
    description: "Aggregate diversity reporting. Off by default and inert unless diversity fields are collected (GDPR-sensitive).",
    category: "Analytics",
    defaultEnabled: false,
  },
  {
    key: "activity_feed",
    label: "Activity feed",
    description: "An org-wide feed of who-did-what, drawn from the audit log.",
    category: "Platform",
    defaultEnabled: true,
  },
  {
    key: "saved_view_sharing",
    label: "Shared saved views",
    description: "Let a saved candidate view be shared with all staff, not just its creator.",
    category: "Platform",
    defaultEnabled: true,
  },
  {
    key: "webhooks",
    label: "Webhooks",
    description: "POST key events (candidate created, stage changed, offer accepted) to external URLs.",
    category: "Platform",
    defaultEnabled: false,
  },
  {
    key: "public_api",
    label: "Read API + API keys",
    description: "Issue API keys for a read-only JSON API over candidates and jobs.",
    category: "Platform",
    defaultEnabled: false,
  },
  {
    key: "gdpr_tools",
    label: "GDPR tools",
    description: "Candidate data export and right-to-erasure, plus a retention overview, in one admin place.",
    category: "Platform",
    defaultEnabled: true,
  },
];

const FEATURE_MAP: Record<string, FeatureDef> = Object.fromEntries(FEATURES.map((f) => [f.key, f]));

function defaultFor(key: FeatureKey): boolean {
  return FEATURE_MAP[key]?.defaultEnabled ?? false;
}

/**
 * Resolve every feature's effective on/off state by merging code defaults with
 * persisted overrides. One cheap query (the table has a handful of rows).
 */
export async function getFeatureStates(): Promise<Record<FeatureKey, boolean>> {
  const state = {} as Record<FeatureKey, boolean>;
  for (const f of FEATURES) state[f.key] = f.defaultEnabled;

  try {
    const rows = await db.select().from(featureFlags);
    for (const r of rows) {
      if (r.key in state) state[r.key as FeatureKey] = r.enabled;
    }
  } catch {
    // If the table doesn't exist yet (pre-migration), fall back to defaults.
  }
  return state;
}

/** Single-feature check. Returns the code default if no override row exists. */
export async function isFeatureEnabled(key: FeatureKey): Promise<boolean> {
  try {
    const rows = await db.select().from(featureFlags);
    const row = rows.find((r) => r.key === key);
    return row ? row.enabled : defaultFor(key);
  } catch {
    return defaultFor(key);
  }
}

/**
 * Guard for server actions. Throws when the feature is off so a disabled
 * feature can't be driven by a stale/forged client even if the UI is hidden.
 */
export async function assertFeatureEnabled(key: FeatureKey): Promise<void> {
  const on = await isFeatureEnabled(key);
  if (!on) {
    const label = FEATURE_MAP[key]?.label || key;
    throw new Error(`Feature "${label}" is currently disabled by an administrator.`);
  }
}
