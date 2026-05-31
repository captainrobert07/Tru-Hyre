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

  // Phase 20: blob → drive column migration. We cannot let drizzle-kit
  // run an interactive prompt (the ambiguous "create vs rename" question
  // hangs on non-TTY runners). Do the column swap deterministically here,
  // BEFORE drizzle-kit push, so by the time push runs, the schema is in
  // sync and push exits cleanly.
  for (const tableName of ["resume_files", "client_packets"]) {
    if (!/^[a-z_]+$/.test(tableName)) continue;
    const cols = await db.execute<{ column_name: string }>(sql.raw(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = '${tableName}'
        AND column_name IN ('blob_url','blob_pathname','drive_file_id','drive_web_view_link')
    `));
    const colRows = (cols.rows || cols) as Array<{ column_name: string }>;
    const have = new Set(colRows.map((r) => r.column_name));

    const hasLegacy = have.has("blob_url") || have.has("blob_pathname");
    const hasNew = have.has("drive_file_id");

    if (hasLegacy && !hasNew) {
      console.log(`[fix-types] ${tableName}: legacy schema → swapping to drive columns`);
      await db.execute(sql.raw(`TRUNCATE TABLE ${tableName} CASCADE`));
      if (have.has("blob_url")) await db.execute(sql.raw(`ALTER TABLE ${tableName} DROP COLUMN blob_url`));
      if (have.has("blob_pathname")) await db.execute(sql.raw(`ALTER TABLE ${tableName} DROP COLUMN blob_pathname`));
      await db.execute(sql.raw(`ALTER TABLE ${tableName} ADD COLUMN drive_file_id text NOT NULL DEFAULT ''`));
      await db.execute(sql.raw(`ALTER TABLE ${tableName} ALTER COLUMN drive_file_id DROP DEFAULT`));
      await db.execute(sql.raw(`ALTER TABLE ${tableName} ADD COLUMN drive_web_view_link text`));
      console.log(`[fix-types]   ${tableName}: dropped blob_*, added drive_file_id + drive_web_view_link`);
    } else if (hasLegacy && hasNew) {
      console.log(`[fix-types] ${tableName}: half-migrated state → finishing the swap`);
      await db.execute(sql.raw(`TRUNCATE TABLE ${tableName} CASCADE`));
      if (have.has("blob_url")) await db.execute(sql.raw(`ALTER TABLE ${tableName} DROP COLUMN blob_url`));
      if (have.has("blob_pathname")) await db.execute(sql.raw(`ALTER TABLE ${tableName} DROP COLUMN blob_pathname`));
      console.log(`[fix-types]   ${tableName}: cleaned up legacy columns`);
    } else if (!hasLegacy && hasNew) {
      console.log(`[fix-types] ${tableName}: already on drive columns, no-op`);
    } else {
      console.log(`[fix-types] ${tableName}: table missing drive columns entirely (will be created by drizzle-kit)`);
    }
  }

  console.log("[fix-types] done");
}

main().catch((e) => {
  console.error("[fix-types] failed:", e);
  process.exit(1);
});
