import bcrypt from "bcryptjs";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { sql, eq } from "drizzle-orm";
import {
  users,
  clientAccounts,
  clientContacts,
  vendorAccounts,
  jobs,
  jobVendors,
  candidates,
  companyProfile,
} from "./schema";

const SEED_PASSWORD = "Kris@35193";

async function main() {
  const url = process.env.POSTGRES_URL || process.env.DATABASE_URL;
  if (!url) throw new Error("POSTGRES_URL or DATABASE_URL must be set");

  const client = neon(url);
  const db = drizzle(client, {
    schema: { users, clientAccounts, clientContacts, vendorAccounts, jobs, jobVendors, candidates, companyProfile },
  });

  console.log("seeding company profile…");
  const existingProfile = await db.select().from(companyProfile).limit(1);
  if (existingProfile.length === 0) {
    await db.insert(companyProfile).values({
      name: "Tru Hyre",
      tagline: "An Allianz HR Platform — Project by Kris",
      contactEmail: "admin@truhyre.app",
    });
  }

  console.log("seeding client accounts…");
  let allianz = (await db.select().from(clientAccounts).where(eq(clientAccounts.name, "Allianz Technology")))[0];
  if (!allianz) {
    [allianz] = await db
      .insert(clientAccounts)
      .values({
        name: "Allianz Technology",
        industry: "Insurance / Financial Services",
        website: "https://www.allianz.com",
        primaryContactName: "Allianz Hiring Manager",
        primaryContactEmail: "client@truhyre.app",
        primaryContactPhone: "+49 89 3800 0",
      })
      .returning();
  }

  const existingPrimary = await db
    .select()
    .from(clientContacts)
    .where(eq(clientContacts.clientAccountId, allianz.id));
  if (existingPrimary.length === 0) {
    await db.insert(clientContacts).values({
      clientAccountId: allianz.id,
      name: "Allianz Hiring Manager",
      email: "client@truhyre.app",
      phone: "+49 89 3800 0",
      title: "Talent Acquisition Lead",
      isPrimary: true,
    });
  }

  console.log("seeding vendor accounts…");
  let talentBridge = (await db.select().from(vendorAccounts).where(eq(vendorAccounts.name, "TalentBridge Staffing")))[0];
  if (!talentBridge) {
    [talentBridge] = await db
      .insert(vendorAccounts)
      .values({
        name: "TalentBridge Staffing",
        contactName: "Vendor Partner",
        contactEmail: "vendor@truhyre.app",
        contactPhone: "+91 80 4000 1234",
        country: "India",
      })
      .returning();
  }

  console.log("seeding users…");
  const hash = await bcrypt.hash(SEED_PASSWORD, 10);
  const seedUsers = [
    { email: "admin@truhyre.app", fullName: "Tru Hyre Admin", role: "admin" as const, clientAccountId: null, vendorAccountId: null },
    { email: "hr@truhyre.app", fullName: "Recruiter Demo", role: "hr" as const, clientAccountId: null, vendorAccountId: null },
    { email: "client@truhyre.app", fullName: "Allianz Hiring Mgr", role: "client" as const, clientAccountId: allianz.id, vendorAccountId: null },
    { email: "vendor@truhyre.app", fullName: "Vendor Partner", role: "vendor" as const, clientAccountId: null, vendorAccountId: talentBridge.id },
  ];

  // IMPORTANT: do NOT overwrite an existing user. The seed must be a one-time
  // bootstrap. If an admin has changed a user's password / role / linkage in
  // production, we don't want a deploy to silently revert it. To force a
  // reset, set SEED_RESET=1 in env.
  const allowReset = process.env.SEED_RESET === "1";
  for (const u of seedUsers) {
    if (allowReset) {
      await db
        .insert(users)
        .values({ ...u, passwordHash: hash, isActive: true })
        .onConflictDoUpdate({
          target: users.email,
          set: {
            fullName: u.fullName,
            role: u.role,
            clientAccountId: u.clientAccountId,
            vendorAccountId: u.vendorAccountId,
            passwordHash: hash,
            isActive: true,
            updatedAt: sql`now()`,
          },
        });
      console.log(`  user (reset): ${u.email} (${u.role})`);
    } else {
      await db
        .insert(users)
        .values({ ...u, passwordHash: hash, isActive: true })
        .onConflictDoNothing({ target: users.email });
      console.log(`  user: ${u.email} (${u.role})`);
    }
  }

  const adminUser = (await db.select().from(users).where(eq(users.email, "admin@truhyre.app")))[0];
  const hrUser = (await db.select().from(users).where(eq(users.email, "hr@truhyre.app")))[0];

  console.log("seeding jobs…");
  const existingJobs = await db.select().from(jobs).where(eq(jobs.clientAccountId, allianz.id));
  if (existingJobs.length === 0) {
    const [job1] = await db
      .insert(jobs)
      .values({
        title: "Senior Backend Engineer (Java/Spring)",
        clientAccountId: allianz.id,
        ownerId: hrUser?.id || adminUser?.id,
        status: "open",
        priority: "high",
        location: "Munich, Germany",
        workMode: "Hybrid",
        experienceMin: "6",
        experienceMax: "10",
        ctcMin: "85000",
        ctcMax: "120000",
        positions: 2,
        description:
          "Build resilient claims-processing services in Java 21 + Spring Boot 3. Strong distributed-systems background expected.",
        skills: ["Java", "Spring Boot", "Kafka", "PostgreSQL", "Kubernetes"],
      })
      .returning();
    const [job2] = await db
      .insert(jobs)
      .values({
        title: "Frontend Engineer (React/TypeScript)",
        clientAccountId: allianz.id,
        ownerId: hrUser?.id || adminUser?.id,
        status: "open",
        priority: "normal",
        location: "Bengaluru, India",
        workMode: "Remote",
        experienceMin: "4",
        experienceMax: "8",
        ctcMin: "1800000",
        ctcMax: "3200000",
        positions: 1,
        description: "Own the agent-portal UI. Next.js + TypeScript + design-system work.",
        skills: ["React", "Next.js", "TypeScript", "Tailwind"],
      })
      .returning();

    if (job1) await db.insert(jobVendors).values({ jobId: job1.id, vendorAccountId: talentBridge.id });
    if (job2) await db.insert(jobVendors).values({ jobId: job2.id, vendorAccountId: talentBridge.id });
    console.log(`  jobs: 2`);
  }

  console.log("seeding candidates…");
  const existingCands = await db.select().from(candidates).where(eq(candidates.refId, "TH-DEMO-001"));
  if (existingCands.length === 0) {
    await db.insert(candidates).values([
      {
        refId: "TH-DEMO-001",
        fullName: "Priya Raman",
        email: "priya.raman.demo@example.com",
        phone: "+91 98765 11111",
        location: "Bengaluru, IN",
        currentTitle: "Senior Software Engineer",
        currentCompany: "Acme Software",
        experienceYears: "7.5",
        noticePeriodDays: 60,
        currentCtc: "2400000",
        expectedCtc: "3000000",
        summary: "Backend engineer specialising in Java + distributed systems.",
        skills: ["Java", "Spring Boot", "Kafka", "AWS"],
        stage: "hr_review",
        parseStatus: "ok",
        vendorAccountId: talentBridge.id,
        uploadedById: hrUser?.id,
      },
      {
        refId: "TH-DEMO-002",
        fullName: "Markus Weber",
        email: "markus.weber.demo@example.com",
        phone: "+49 151 22223333",
        location: "Munich, DE",
        currentTitle: "Backend Lead",
        currentCompany: "FinServ GmbH",
        experienceYears: "9",
        noticePeriodDays: 90,
        currentCtc: "92000",
        expectedCtc: "115000",
        summary: "Lead engineer on claims platforms; deep Spring + Kafka experience.",
        skills: ["Java", "Spring Boot", "Kafka", "Kubernetes"],
        stage: "screening",
        parseStatus: "ok",
        vendorAccountId: talentBridge.id,
        uploadedById: hrUser?.id,
      },
      {
        refId: "TH-DEMO-003",
        fullName: "Anjali Sharma",
        email: "anjali.sharma.demo@example.com",
        phone: "+91 99887 66554",
        location: "Pune, IN",
        currentTitle: "Frontend Engineer",
        currentCompany: "DesignCo",
        experienceYears: "5",
        noticePeriodDays: 45,
        currentCtc: "1900000",
        expectedCtc: "2600000",
        summary: "Next.js + TypeScript specialist; led the design-system rollout at DesignCo.",
        skills: ["React", "Next.js", "TypeScript", "Tailwind"],
        stage: "received",
        parseStatus: "ok",
        vendorAccountId: talentBridge.id,
        uploadedById: hrUser?.id,
      },
    ]);
    console.log(`  candidates: 3`);
  }

  console.log("\nseed complete.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
