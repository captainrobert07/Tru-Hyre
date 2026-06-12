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
  | "command_palette";

export type FeatureCategory = "Scheduling" | "Communication" | "Sourcing" | "Productivity";

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
