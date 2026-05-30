import { NextResponse } from "next/server";
import { ilike, or, sql, desc } from "drizzle-orm";
import { db } from "@/db";
import { candidates, jobs, clientAccounts, vendorAccounts } from "@/db/schema";
import { auth } from "@/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ results: [] }, { status: 401 });
  const role = (session.user as { role?: string }).role;
  if (role !== "admin" && role !== "hr") return NextResponse.json({ results: [] });

  const url = new URL(req.url);
  const q = (url.searchParams.get("q") || "").trim();
  if (q.length < 1) return NextResponse.json({ results: [] });
  const like = `%${q}%`;

  const [cands, js, cls, vs] = await Promise.all([
    db
      .select({
        id: candidates.id,
        fullName: candidates.fullName,
        currentTitle: candidates.currentTitle,
        refId: candidates.refId,
        stage: candidates.stage,
      })
      .from(candidates)
      .where(or(
        ilike(candidates.fullName, like),
        ilike(candidates.email, like),
        ilike(candidates.currentTitle, like),
        ilike(candidates.refId, like),
        sql`${candidates.skills}::text ilike ${like}`,
      ))
      .orderBy(desc(candidates.createdAt))
      .limit(8),
    db
      .select({ id: jobs.id, title: jobs.title, status: jobs.status, location: jobs.location })
      .from(jobs)
      .where(or(ilike(jobs.title, like), ilike(jobs.location, like)))
      .orderBy(desc(jobs.createdAt))
      .limit(6),
    db
      .select({ id: clientAccounts.id, name: clientAccounts.name, industry: clientAccounts.industry })
      .from(clientAccounts)
      .where(or(ilike(clientAccounts.name, like), ilike(clientAccounts.industry, like)))
      .limit(4),
    db
      .select({ id: vendorAccounts.id, name: vendorAccounts.name, country: vendorAccounts.country })
      .from(vendorAccounts)
      .where(or(ilike(vendorAccounts.name, like), ilike(vendorAccounts.country, like)))
      .limit(4),
  ]);

  return NextResponse.json({
    candidates: cands,
    jobs: js,
    clients: cls,
    vendors: vs,
  });
}
