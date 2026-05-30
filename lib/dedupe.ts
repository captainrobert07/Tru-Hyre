import { createHash } from "crypto";
import { eq, or, like, sql } from "drizzle-orm";
import { db } from "@/db";
import { candidates, resumeFiles } from "@/db/schema";

export function contentHash(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

function lastTen(phone: string | null): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  return digits.length >= 10 ? digits.slice(-10) : null;
}

export type DupeMatch = {
  reason: "email" | "phone" | "hash" | "name";
  candidateId: number;
  fullName: string;
  email: string | null;
};

export async function findDuplicates(opts: {
  email?: string | null;
  phone?: string | null;
  fullName?: string | null;
  hash?: string | null;
}): Promise<DupeMatch[]> {
  const out: DupeMatch[] = [];
  const seen = new Set<number>();

  if (opts.email) {
    const rows = await db
      .select({ id: candidates.id, fullName: candidates.fullName, email: candidates.email })
      .from(candidates)
      .where(eq(candidates.email, opts.email));
    for (const r of rows) if (!seen.has(r.id)) { out.push({ reason: "email", ...r }); seen.add(r.id); }
  }

  const tail = lastTen(opts.phone || null);
  if (tail) {
    const rows = await db
      .select({ id: candidates.id, fullName: candidates.fullName, email: candidates.email })
      .from(candidates)
      .where(like(candidates.phone, `%${tail}`));
    for (const r of rows) if (!seen.has(r.id)) { out.push({ reason: "phone", ...r }); seen.add(r.id); }
  }

  if (opts.hash) {
    const rows = await db
      .select({
        id: candidates.id,
        fullName: candidates.fullName,
        email: candidates.email,
      })
      .from(resumeFiles)
      .innerJoin(candidates, eq(resumeFiles.candidateId, candidates.id))
      .where(eq(resumeFiles.contentHash, opts.hash));
    for (const r of rows) if (!seen.has(r.id)) { out.push({ reason: "hash", ...r }); seen.add(r.id); }
  }

  if (opts.fullName) {
    const trimmed = opts.fullName.trim();
    if (trimmed.length >= 4) {
      const rows = await db
        .select({ id: candidates.id, fullName: candidates.fullName, email: candidates.email })
        .from(candidates)
        .where(sql`lower(${candidates.fullName}) = lower(${trimmed})`);
      for (const r of rows) if (!seen.has(r.id)) { out.push({ reason: "name", ...r }); seen.add(r.id); }
    }
  }

  return out;
}
