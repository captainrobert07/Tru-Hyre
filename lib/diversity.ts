/**
 * Voluntary diversity self-identification (EEO).
 *
 * These fields are collected ONLY when an applicant explicitly opts in on the
 * public careers form, are never required, and always offer a "prefer not to
 * say" choice. Aggregates are shown only when the `diversity_reporting` feature
 * is enabled, and reporting suppresses any bucket below a small-count threshold
 * so individuals can't be re-identified. Keep this list short and GDPR-conscious.
 */

export type DiversityField = {
  key: string;
  label: string;
  options: string[];
};

export const PREFER_NOT_TO_SAY = "Prefer not to say";

export const DIVERSITY_FIELDS: DiversityField[] = [
  {
    key: "gender",
    label: "Gender",
    options: ["Woman", "Man", "Non-binary", "Self-describe / other", PREFER_NOT_TO_SAY],
  },
  {
    key: "ethnicity",
    label: "Ethnicity",
    options: ["Asian", "Black", "Hispanic / Latino", "Middle Eastern", "White", "Mixed / multiple", "Other", PREFER_NOT_TO_SAY],
  },
  {
    key: "disability",
    label: "Disability status",
    options: ["Yes", "No", PREFER_NOT_TO_SAY],
  },
  {
    key: "veteran",
    label: "Veteran status",
    options: ["Yes", "No", PREFER_NOT_TO_SAY],
  },
];

const FIELD_MAP = Object.fromEntries(DIVERSITY_FIELDS.map((f) => [f.key, f]));

/** Keep only known fields whose value is a permitted option. Drops everything else. */
export function sanitizeDiversity(input: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const field of DIVERSITY_FIELDS) {
    const raw = input[field.key];
    if (typeof raw === "string" && field.options.includes(raw) && raw !== PREFER_NOT_TO_SAY) {
      out[field.key] = raw;
    }
  }
  return out;
}

export function fieldLabel(key: string): string {
  return FIELD_MAP[key]?.label ?? key;
}

/** Below this count a bucket is suppressed in reporting to protect individuals. */
export const MIN_REPORTABLE_COUNT = 5;
