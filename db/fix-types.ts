/**
 * One-shot column-type normalization. Runs in vercel-build BEFORE
 * drizzle-kit push. Idempotent: only fires when the column is still
 * a sequence-backed serial. Once fixed, this is a no-op forever.
 *
 * Why this exists: in Phase 1 users.clientAccountId / vendorAccountId
 * were defined as serial (mistake — they're FKs, not auto-increment).
 * Phase 2 changed them to integer in the schema, but the live DB
 * column type was already serial. Drizzle-kit push --force keeps
 * detecting the diff and CASCADE-truncating the users table on every
 * deploy. This script does the column-type conversion as a deterministic
 * SQL ALTER without truncating, so drizzle's next push sees no diff.
 */
import { neon } from "@neondatabase/serverless";

async function main() {
  const url = process.env.POSTGRES_URL || process.env.DATABASE_URL;
  if (!url) {
    console.log("[fix-types] no DB url, skipping");
    return;
  }
  const sql = neon(url);

  // Detect whether either column is still owned by a sequence (i.e., serial).
  const probe = await sql<{ column_name: string; is_serial: boolean }[]>`
    SELECT
      column_name,
      (column_default IS NOT NULL AND column_default LIKE 'nextval(%') AS is_serial
    FROM information_schema.columns
    WHERE table_name = 'users'
      AND column_name IN ('client_account_id', 'vendor_account_id')
  `;

  const needsFix = probe.filter((r) => r.is_serial);
  if (needsFix.length === 0) {
    console.log("[fix-types] users FK columns already integer, no-op");
    return;
  }

  console.log(`[fix-types] converting ${needsFix.length} serial columns to plain integer…`);
  for (const r of needsFix) {
    const col = r.column_name;
    // Drop the default (nextval), drop the owned-by sequence, leave the values intact.
    // Type stays integer-compatible so no data loss.
    await sql.query(`ALTER TABLE users ALTER COLUMN ${col} DROP DEFAULT`);
    // Find and drop the orphan sequence
    const seqName = `users_${col}_seq`;
    await sql.query(`DROP SEQUENCE IF EXISTS ${seqName}`);
    console.log(`[fix-types]   ${col}: dropped default + sequence`);
  }
  console.log("[fix-types] done");
}

main().catch((e) => {
  console.error("[fix-types] failed:", e);
  process.exit(1);
});
