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
import { drizzle } from "drizzle-orm/neon-http";
import { sql } from "drizzle-orm";

async function main() {
  const url = process.env.POSTGRES_URL || process.env.DATABASE_URL;
  if (!url) {
    console.log("[fix-types] no DB url, skipping");
    return;
  }
  const client = neon(url);
  const db = drizzle(client);

  // Detect whether either column is still owned by a sequence (i.e., serial).
  const probe = await db.execute<{ column_name: string; is_serial: boolean }>(sql`
    SELECT
      column_name,
      (column_default IS NOT NULL AND column_default LIKE 'nextval(%') AS is_serial
    FROM information_schema.columns
    WHERE table_name = 'users'
      AND column_name IN ('client_account_id', 'vendor_account_id')
  `);

  const probeRows = (probe.rows || probe) as Array<{ column_name: string; is_serial: boolean }>;
  const needsFix = probeRows.filter((r) => r.is_serial);
  if (needsFix.length === 0) {
    console.log("[fix-types] users FK columns already integer, no-op");
    return;
  }

  if (needsFix.length > 0) {
    console.log(`[fix-types] converting ${needsFix.length} serial columns to plain integer…`);
    for (const r of needsFix) {
      const col = r.column_name;
      if (!/^[a-z_]+$/.test(col)) {
        console.warn(`[fix-types] skipping suspicious col name ${col}`);
        continue;
      }
      await db.execute(sql.raw(`ALTER TABLE users ALTER COLUMN ${col} DROP DEFAULT`));
      const seqName = `users_${col}_seq`;
      await db.execute(sql.raw(`DROP SEQUENCE IF EXISTS ${seqName}`));
      console.log(`[fix-types]   ${col}: dropped default + sequence`);
    }
  }

  // Phase 20: blob → drive column rename. drizzle-kit push --force cannot
  // add a NOT NULL column ('drive_file_id') to a non-empty table, so we
  // truncate resume_files and client_packets first. Pre-pilot — accepted
  // data loss, candidates rows survive (just lose their resume PDF link).
  // Idempotent: once the columns are renamed, the legacy column probe is
  // empty and this branch is a no-op.
  const legacyCheck = await db.execute<{ table_name: string }>(sql`
    SELECT table_name
    FROM information_schema.columns
    WHERE column_name = 'blob_url'
      AND table_name IN ('resume_files', 'client_packets')
  `);
  const legacyRows = (legacyCheck.rows || legacyCheck) as Array<{ table_name: string }>;
  if (legacyRows.length > 0) {
    console.log("[fix-types] truncating resume_files + client_packets for Drive cutover…");
    await db.execute(sql.raw(`TRUNCATE TABLE resume_files, client_packets`));
    console.log("[fix-types]   truncated");
  }

  console.log("[fix-types] done");
}

main().catch((e) => {
  console.error("[fix-types] failed:", e);
  process.exit(1);
});
