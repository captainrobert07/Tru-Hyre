import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { candidates, vendorAccounts } from "@/db/schema";
import { auth } from "@/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const role = (session.user as { role?: string }).role;
  if (role !== "admin" && role !== "hr") return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { id } = await params;
  const candidateId = Number(id);
  if (!Number.isFinite(candidateId)) return NextResponse.json({ error: "invalid_id" }, { status: 400 });

  const row = (
    await db
      .select({
        id: candidates.id,
        refId: candidates.refId,
        fullName: candidates.fullName,
        email: candidates.email,
        phone: candidates.phone,
        location: candidates.location,
        currentTitle: candidates.currentTitle,
        currentCompany: candidates.currentCompany,
        experienceYears: candidates.experienceYears,
        noticePeriodDays: candidates.noticePeriodDays,
        currentCtc: candidates.currentCtc,
        expectedCtc: candidates.expectedCtc,
        summary: candidates.summary,
        skills: candidates.skills,
        stage: candidates.stage,
        vendorName: vendorAccounts.name,
        createdAt: candidates.createdAt,
      })
      .from(candidates)
      .leftJoin(vendorAccounts, eq(candidates.vendorAccountId, vendorAccounts.id))
      .where(eq(candidates.id, candidateId))
  )[0];

  if (!row) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json(row);
}
