import { sql } from "drizzle-orm";
import { db } from "@/db";
import { candidates } from "@/db/schema";
import { callTool } from "@/lib/ai";

/**
 * Natural-language candidate search. Claude turns a free-text query
 * ("senior java engineers in Bangalore open to relocating, 8+ years") into
 * structured criteria, which we run as a SQL filter + skill-overlap ranking.
 * Falls back to a plain ILIKE search when AI is unavailable.
 */

export type SearchHit = {
  id: number;
  fullName: string;
  currentTitle: string | null;
  location: string | null;
  experienceYears: string | null;
  skills: string[];
  stage: string;
  matchedSkills: string[];
};

export type SearchResult = {
  criteria: ExtractedCriteria;
  hits: SearchHit[];
  usedAi: boolean;
};

type ExtractedCriteria = {
  skills: string[];
  minExperience: number | null;
  location: string | null;
  keywords: string[];
};

const CRITERIA_TOOL = {
  name: "search_criteria",
  description: "Structured search criteria extracted from the recruiter's query.",
  input_schema: {
    type: "object" as const,
    properties: {
      skills: { type: "array", items: { type: "string" }, description: "Specific tools/technologies named or implied" },
      minExperience: { type: ["number", "null"], description: "Minimum years of experience, or null" },
      location: { type: ["string", "null"], description: "City/region/country, or null" },
      keywords: { type: "array", items: { type: "string" }, description: "Other free-text terms to match in title/summary" },
    },
    required: ["skills"],
  },
};

async function extractCriteria(query: string): Promise<{ criteria: ExtractedCriteria; usedAi: boolean }> {
  const ai = await callTool<Partial<ExtractedCriteria>>({
    system:
      "Extract structured candidate-search criteria from a recruiter's natural-language query. " +
      "Only include what's stated or strongly implied. Skills should be concrete technologies.",
    prompt: query,
    tool: CRITERIA_TOOL,
    maxTokens: 500,
  });

  if (!ai) {
    // Fallback: treat the whole query as keywords.
    return {
      criteria: { skills: [], minExperience: null, location: null, keywords: query.split(/\s+/).filter((w) => w.length > 2) },
      usedAi: false,
    };
  }
  return {
    criteria: {
      skills: Array.isArray(ai.skills) ? ai.skills.filter((s): s is string => typeof s === "string") : [],
      minExperience: typeof ai.minExperience === "number" ? ai.minExperience : null,
      location: typeof ai.location === "string" ? ai.location : null,
      keywords: Array.isArray(ai.keywords) ? ai.keywords.filter((s): s is string => typeof s === "string") : [],
    },
    usedAi: true,
  };
}

export async function semanticSearch(query: string): Promise<SearchResult> {
  const { criteria, usedAi } = await extractCriteria(query);

  const skillsLower = criteria.skills.map((s) => s.toLowerCase());
  const kw = criteria.keywords.join(" ").trim();
  const likeKw = kw ? `%${kw}%` : null;

  const rows = await db.execute<{
    id: number;
    full_name: string;
    current_title: string | null;
    location: string | null;
    experience_years: string | null;
    skills: string[];
    stage: string;
    overlap: number;
  }>(sql`
    SELECT
      c.id, c.full_name, c.current_title, c.location, c.experience_years, c.skills, c.stage,
      COALESCE((
        SELECT COUNT(*) FROM jsonb_array_elements_text(c.skills) sk
        WHERE lower(sk) = ANY(${skillsLower}::text[])
      ), 0)::int AS overlap
    FROM ${candidates} c
    WHERE c.stage NOT IN ('rejected')
      AND (
        ${skillsLower.length === 0}
        OR EXISTS (
          SELECT 1 FROM jsonb_array_elements_text(c.skills) sk
          WHERE lower(sk) = ANY(${skillsLower}::text[])
        )
      )
      AND (${criteria.minExperience === null} OR c.experience_years >= ${criteria.minExperience ?? 0})
      AND (${criteria.location === null} OR c.location ILIKE ${"%" + (criteria.location ?? "") + "%"})
      AND (${likeKw === null} OR c.full_name ILIKE ${likeKw} OR c.current_title ILIKE ${likeKw} OR c.summary ILIKE ${likeKw})
    ORDER BY overlap DESC, c.updated_at DESC
    LIMIT 40
  `);

  const data = (rows.rows || rows) as Array<{
    id: number; full_name: string; current_title: string | null; location: string | null;
    experience_years: string | null; skills: string[]; stage: string; overlap: number;
  }>;

  const hits: SearchHit[] = data.map((r) => ({
    id: r.id,
    fullName: r.full_name,
    currentTitle: r.current_title,
    location: r.location,
    experienceYears: r.experience_years,
    skills: r.skills || [],
    stage: r.stage,
    matchedSkills: (r.skills || []).filter((s) => skillsLower.includes(s.toLowerCase())),
  }));

  return { criteria, hits, usedAi };
}
