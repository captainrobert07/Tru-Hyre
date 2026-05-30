import bcrypt from "bcryptjs";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { sql as drizzleSql } from "drizzle-orm";
import { users } from "./schema";

const SEED_PASSWORD = "Kris@35193";

const SEED_USERS = [
  { email: "admin@truhyre.app", fullName: "Tru Hyre Admin", role: "admin" as const },
  { email: "hr@truhyre.app", fullName: "Recruiter Demo", role: "hr" as const },
  { email: "client@truhyre.app", fullName: "Allianz Hiring Mgr", role: "client" as const },
  { email: "vendor@truhyre.app", fullName: "Vendor Partner", role: "vendor" as const },
];

async function main() {
  const url = process.env.POSTGRES_URL || process.env.DATABASE_URL;
  if (!url) throw new Error("POSTGRES_URL or DATABASE_URL must be set");

  const sql = neon(url);
  const db = drizzle(sql, { schema: { users } });

  const hash = await bcrypt.hash(SEED_PASSWORD, 10);

  for (const u of SEED_USERS) {
    await db
      .insert(users)
      .values({ ...u, passwordHash: hash, isActive: true })
      .onConflictDoUpdate({
        target: users.email,
        set: {
          fullName: u.fullName,
          role: u.role,
          passwordHash: hash,
          isActive: true,
          updatedAt: drizzleSql`now()`,
        },
      });
    console.log(`seeded: ${u.email} (${u.role})`);
  }

  console.log("\nAll seeded users ready. Initial password: Kris@35193");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
