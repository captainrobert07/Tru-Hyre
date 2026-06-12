import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { candidates, jobs, candidateScores } from "@/db/schema";
import { callTool } from "@/lib/ai";

/**
 * Candidate↔job match scoring. Two tiers to keep LLM cost bounded:
 *   1. Cheap SQL prefilter — rank the pool by skill overlap (+ experience/CTC
 *      fit) and take the top N. No LLM call.
 *   2. Claude scores ONLY that shortlist 0–100 with reasons.
 * Results cache to candidate_scores (one row per pair), refreshed on demand.
 */

const SHORTLIST_SIZE = 25;

export type MatchRow = {
  candidateId: number;
  fullName: string;
  currentTitle: string | null;
  experienceYears: string | null;
  skills: string[];
  score: number;
  reasons: string[];
  computedAt: string;
  cached: boolean;
};

type PrefilterRow = {
  id: number;
  full_name: string;
  current_title: string | null;
  experience_years: string | null;
  expected_ctc: string | null;
  summary: string | null;
  skills: string[];
  overlap: number;
};

const SCORE_TOOL = {
  name: "score_candidates",
  description: "Return a fit score 0-100 and 1-3 short reasons for each candidate.",
  input_schema: {
    type: "object" as const,
    properties: {
      scores: {
        type: "array",
        items: {
          type: "object",
          properties: {
            candidateId: { type: "number" },
            score: { type: "number", description: "0-100 fit for the role" },
            reasons: { type: "array", items: { type: "string" }, description: "1-3 concise reasons" },
          },
          required: ["candidateId", "score"],
        },
      },
    },
    required: ["scores"],
  },
};

/** Read cached scores for a job (no compute). Highest first. */
export async function getCachedScores(jobId: number): Promise<MatchRow[]> {
  const rows = await db
    .select({
      candidateId: candidateScores.candidateId,
      score: candidateScores.score,
      reasons: candidateScores.reasons,
      computedAt: candidateScores.computedAt,
      fullName: candidates.fullName,
      currentTitle: candidates.currentTitle,
      experienceYears: candidates.experienceYears,
      skills: candidates.skills,
    })
    .from(candidateScores)
    .innerJoin(candidates, eq(candidateScores.candidateId, candidates.id))
    .where(eq(candidateScores.jobId, jobId))
    .orderBy(sql`${candidateScores.score} desc`)
    .limit(50);

  return rows.map((r) => ({
    candidateId: r.candidateId,
    fullName: r.fullName,
    currentTitle: r.currentTitle,
    experienceYears: r.experienceYears,
    skills: r.skills || [],
    score: r.score,
    reasons: r.reasons || [],
    computedAt: r.computedAt.toISOString(),
    cached: true,
  }));
}

/**
 * Recompute scores for a job: SQL prefilter → Claude → cache. Returns the fresh
 * ranked list. If AI is unavailable, falls back to the prefilter overlap as a
 * proxy score so the feature still ranks something useful.
 */
export async function computeMatchScores(jobId: number): Promise<MatchRow[]> {
  const job = (await db.select().from(jobs).where(eq(jobs.id, jobId)))[0];
  if (!job) return [];

  const jobSkills = (job.skills || []).map((s) => s.toLowerCase());

  // 1. Prefilter: rank by count of overlapping skills (case-insensitive),
  // limited to non-terminal candidates. Done entirely in SQL.
  const prefiltered = await db.execute<PrefilterRow>(sql`
    SELECT
      c.id, c.full_name, c.current_title, c.experience_years, c.expected_ctc,
      c.summary, c.skills,
      COALESCE((
        SELECT COUNT(*) FROM jsonb_array_elements_text(c.skills) sk
        WHERE lower(sk) = ANY(${jobSkills}::text[])
      ), 0)::int AS overlap
    FROM ${candidates} c
    WHERE c.stage NOT IN ('joined', 'rejected')
    ORDER BY overlap DESC, c.updated_at DESC
    LIMIT ${SHORTLIST_SIZE}
  `);

  const shortlist = (prefiltered.rows || prefiltered) as PrefilterRow[];
  if (shortlist.length === 0) return [];

  // 2. Claude scores the shortlist.
  const jobBlurb =
    `Title: ${job.title}\n` +
    `Required skills: ${(job.skills || []).join(", ") || "—"}\n` +
    `Experience: ${job.experienceMin || "?"}–${job.experienceMax || "?"} years\n` +
    `Description: ${(job.description || "").slice(0, 1500)}`;

  const candidateBlurbs = shortlist
    .map((c) =>
      `Candidate ${c.id}: ${c.full_name}; title: ${c.current_title || "—"}; ` +
      `experience: ${c.experience_years || "?"}y; skills: ${(c.skills || []).join(", ") || "—"}; ` +
      `summary: ${(c.summary || "").slice(0, 400)}`,
    )
    .join("\n");

  const ai = await callTool<{ scores: Array<{ candidateId: number; score: number; reasons?: string[] }> }>({
    system:
      "You are a technical recruiter scoring candidate fit for a job. Score each candidate 0-100 " +
      "(100 = ideal). Weigh skills match, experience level, and relevant background. Give 1-3 short, " +
      "specific reasons. Be calibrated: most candidates are 40-75; reserve 85+ for genuinely strong fits.",
    prompt: `JOB\n${jobBlurb}\n\nCANDIDATES\n${candidateBlurbs}\n\nScore every candidate via the tool.`,
    tool: SCORE_TOOL,
    maxTokens: 2000,
  });

  const now = new Date();
  let results: MatchRow[];

  if (ai?.scores?.length) {
    const byId = new Map(shortlist.map((c) => [c.id, c]));
    results = ai.scores
      .filter((s) => byId.has(s.candidateId))
      .map((s) => {
        const c = byId.get(s.candidateId)!;
        return {
          candidateId: c.id,
          fullName: c.full_name,
          currentTitle: c.current_title,
          experienceYears: c.experience_years,
          skills: c.skills || [],
          score: Math.max(0, Math.min(100, Math.round(s.score))),
          reasons: (s.reasons || []).slice(0, 3),
          computedAt: now.toISOString(),
          cached: false,
        };
      });
  } else {
    // Fallback: proxy score from skill overlap so the tab still ranks.
    const maxOverlap = Math.max(1, ...shortlist.map((c) => c.overlap));
    results = shortlist.map((c) => ({
      candidateId: c.id,
      fullName: c.full_name,
      currentTitle: c.current_title,
      experienceYears: c.experience_years,
      skills: c.skills || [],
      score: Math.round((c.overlap / maxOverlap) * 70), // cap proxy at 70
      reasons: c.overlap > 0 ? [`${c.overlap} matching skill${c.overlap === 1 ? "" : "s"}`] : ["No skill overlap"],
      computedAt: now.toISOString(),
      cached: false,
    }));
  }

  // 3. Cache (upsert per pair).
  if (results.length) {
    const modelName = process.env.ANTHROPIC_MODEL || "claude-haiku-4-5-20251001";
    for (const r of results) {
      await db
        .insert(candidateScores)
        .values({ candidateId: r.candidateId, jobId, score: r.score, reasons: r.reasons, model: ai ? modelName : "prefilter", computedAt: now })
        .onConflictDoUpdate({
          target: [candidateScores.candidateId, candidateScores.jobId],
          set: { score: r.score, reasons: r.reasons, model: ai ? modelName : "prefilter", computedAt: now },
        });
    }
  }

  results.sort((a, b) => b.score - a.score);
  return results;
}
