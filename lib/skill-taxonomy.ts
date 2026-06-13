/**
 * Skill taxonomy: maps common aliases/abbreviations to a canonical skill, and
 * back to all known surface forms. Used so a search/match for "JS" also hits
 * candidates tagged "JavaScript" (and vice versa).
 *
 * SYNONYMS: alias (lowercase) → canonical (lowercase).
 * Each canonical also reverse-expands to every alias that points at it.
 */
const SYNONYMS: Record<string, string> = {
  js: "javascript",
  ts: "typescript",
  "node": "node.js",
  nodejs: "node.js",
  "react.js": "react",
  reactjs: "react",
  "next": "next.js",
  nextjs: "next.js",
  py: "python",
  golang: "go",
  "c sharp": "c#",
  csharp: "c#",
  dotnet: ".net",
  "dot net": ".net",
  "postgres": "postgresql",
  psql: "postgresql",
  k8s: "kubernetes",
  "tf": "terraform",
  gcp: "google cloud",
  "aws cloud": "aws",
  ml: "machine learning",
  "ai/ml": "machine learning",
  "tf2": "tensorflow",
  pytorch: "pytorch",
  "power bi": "powerbi",
  "rest": "rest api",
  restful: "rest api",
  "ci cd": "ci/cd",
  cicd: "ci/cd",
};

// Build canonical → [aliases] once at module load.
const CANON_TO_ALIASES: Record<string, string[]> = {};
for (const [alias, canon] of Object.entries(SYNONYMS)) {
  (CANON_TO_ALIASES[canon] ||= []).push(alias);
}

/** Canonical form of a single skill (lowercased). */
export function canonicalSkill(skill: string): string {
  const s = skill.trim().toLowerCase();
  return SYNONYMS[s] || s;
}

/**
 * Expand a list of skills into the full set of lowercase surface forms to match
 * against — each input plus its canonical plus every known alias of that
 * canonical. De-duplicated.
 */
export function expandSkills(skills: string[]): string[] {
  const out = new Set<string>();
  for (const raw of skills) {
    const s = raw.trim().toLowerCase();
    if (!s) continue;
    out.add(s);
    const canon = SYNONYMS[s] || s;
    out.add(canon);
    for (const alias of CANON_TO_ALIASES[canon] || []) out.add(alias);
  }
  return [...out];
}
