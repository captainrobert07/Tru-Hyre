import { sql } from "drizzle-orm";
import { db } from "@/db";
import { candidates } from "@/db/schema";

/**
 * Pool-wide duplicate scan. Finds candidate pairs that exact-match dedupe (at
 * upload) might miss: same normalized name, shared phone tail, or same email.
 * Returns clusters for human review — never auto-merges.
 *
 * This is the deterministic core. With the ai_dedupe flag we additionally let
 * Claude judge "fuzzy" near-name pairs, but the SQL pass alone is useful and
 * cheap, so the feature degrades gracefully without a key.
 */

export type DupPair = {
  reason: "email" | "phone" | "name";
  a: { id: number; fullName: string; email: string | null; createdAt: string };
  b: { id: number; fullName: string; email: string | null; createdAt: string };
};

type RawPair = {
  reason: string;
  // neon-http returns timestamp columns as ISO strings from a raw db.execute
  // (not parsed Date objects — that's the convention everywhere else, e.g.
  // metrics.ts). Typing these as Date was a lie about the runtime shape: the
  // `new Date(...)` wrapper below only works *because* they're strings. Keep the
  // type honest so nobody trusts it and drops the parse.
  a_id: number; a_name: string; a_email: string | null; a_created: string;
  b_id: number; b_name: string; b_email: string | null; b_created: string;
};

export async function scanDuplicates(limit = 100): Promise<DupPair[]> {
  // Self-join the candidate table on three weak keys. a.id < b.id so each
  // unordered pair appears once. Cap output.
  const rows = await db.execute<RawPair>(sql`
    WITH norm AS (
      SELECT
        id, full_name, email, created_at,
        lower(regexp_replace(coalesce(full_name,''), '\\s+', ' ', 'g')) AS name_key,
        lower(coalesce(email,'')) AS email_key,
        right(regexp_replace(coalesce(phone,''), '\\D', '', 'g'), 10) AS phone_key
      FROM ${candidates}
    )
    SELECT * FROM (
      SELECT 'email' AS reason,
        a.id AS a_id, a.full_name AS a_name, a.email AS a_email, a.created_at AS a_created,
        b.id AS b_id, b.full_name AS b_name, b.email AS b_email, b.created_at AS b_created
      FROM norm a JOIN norm b ON a.id < b.id
      WHERE a.email_key <> '' AND a.email_key = b.email_key

      UNION ALL
      SELECT 'phone',
        a.id, a.full_name, a.email, a.created_at,
        b.id, b.full_name, b.email, b.created_at
      FROM norm a JOIN norm b ON a.id < b.id
      WHERE length(a.phone_key) = 10 AND a.phone_key = b.phone_key

      UNION ALL
      SELECT 'name',
        a.id, a.full_name, a.email, a.created_at,
        b.id, b.full_name, b.email, b.created_at
      FROM norm a JOIN norm b ON a.id < b.id
      WHERE a.name_key <> '' AND a.name_key = b.name_key
    ) pairs
    ORDER BY reason, a_id
    LIMIT ${limit}
  `);

  const data = (rows.rows || rows) as RawPair[];
  // De-dup the same pair appearing under multiple reasons — keep the strongest
  // (email > phone > name).
  const rank: Record<string, number> = { email: 3, phone: 2, name: 1 };
  const best = new Map<string, RawPair>();
  for (const r of data) {
    const key = `${r.a_id}-${r.b_id}`;
    const existing = best.get(key);
    if (!existing || rank[r.reason] > rank[existing.reason]) best.set(key, r);
  }

  return [...best.values()].map((r) => ({
    reason: r.reason as DupPair["reason"],
    a: { id: r.a_id, fullName: r.a_name, email: r.a_email, createdAt: new Date(r.a_created).toISOString() },
    b: { id: r.b_id, fullName: r.b_name, email: r.b_email, createdAt: new Date(r.b_created).toISOString() },
  }));
}
