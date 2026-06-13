import { NextResponse } from "next/server";
import { desc } from "drizzle-orm";
import { db } from "@/db";
import { candidates } from "@/db/schema";
import { verifyApiKeyRow } from "@/lib/api-keys";
import { isFeatureEnabled } from "@/lib/features";
import { logAudit } from "@/lib/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function bearer(req: Request): string | null {
  const h = req.headers.get("authorization") || "";
  return h.startsWith("Bearer ") ? h.slice(7) : null;
}

export async function GET(req: Request) {
  if (!(await isFeatureEnabled("public_api"))) {
    return NextResponse.json({ error: "API disabled" }, { status: 404 });
  }
  const keyRow = await verifyApiKeyRow(bearer(req));
  if (!keyRow) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  // Audit each authenticated API read so leaked-key use is traceable.
  await logAudit({
    action: "view",
    targetType: "api_key",
    targetId: keyRow.id,
    summary: `API read /api/v1/candidates via key ${keyRow.prefix}…`,
  });

  const url = new URL(req.url);
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit")) || 50));

  // Read-only, non-PII-light projection. (No internal notes / vendor ids.)
  const rows = await db
    .select({
      refId: candidates.refId,
      fullName: candidates.fullName,
      currentTitle: candidates.currentTitle,
      location: candidates.location,
      experienceYears: candidates.experienceYears,
      skills: candidates.skills,
      stage: candidates.stage,
      source: candidates.source,
      createdAt: candidates.createdAt,
    })
    .from(candidates)
    .orderBy(desc(candidates.createdAt))
    .limit(limit);

  return NextResponse.json({ data: rows, count: rows.length });
}
