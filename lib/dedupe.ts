import { createHash } from "crypto";
import { eq, like, sql } from "drizzle-orm";
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
  const push = (reason: DupeMatch["reason"], r: { candidateId: number; fullName: string; email: string | null }) => {
    if (seen.has(r.candidateId)) return;
    out.push({ reason, ...r });
    seen.add(r.candidateId);
  };

  if (opts.email) {
    const rows = await db
      .select({ candidateId: candidates.id, fullName: candidates.fullName, email: candidates.email })
      .from(candidates)
      .where(eq(candidates.email, opts.email));
    for (const r of rows) push("email", r);
  }

  const tail = lastTen(opts.phone || null);
  if (tail) {
    const rows = await db
      .select({ candidateId: candidates.id, fullName: candidates.fullName, email: candidates.email })
      .from(candidates)
      .where(like(candidates.phone, `%${tail}`));
    for (const r of rows) push("phone", r);
  }

  if (opts.hash) {
    const rows = await db
      .select({
        candidateId: candidates.id,
        fullName: candidates.fullName,
        email: candidates.email,
      })
      .from(resumeFiles)
      .innerJoin(candidates, eq(resumeFiles.candidateId, candidates.id))
      .where(eq(resumeFiles.contentHash, opts.hash));
    for (const r of rows) push("hash", r);
  }

  if (opts.fullName) {
    const trimmed = opts.fullName.trim();
    if (trimmed.length >= 4) {
      const rows = await db
        .select({ candidateId: candidates.id, fullName: candidates.fullName, email: candidates.email })
        .from(candidates)
        .where(sql`lower(${candidates.fullName}) = lower(${trimmed})`);
      for (const r of rows) push("name", r);
    }
  }

  return out;
}
