import { NextResponse } from "next/server";
import { desc } from "drizzle-orm";
import { db } from "@/db";
import { auditLog } from "@/db/schema";
import { requireAdmin } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = typeof v === "string" ? v : typeof v === "object" ? JSON.stringify(v) : String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function GET() {
  const me = await requireAdmin();

  const rows = await db.select().from(auditLog).orderBy(desc(auditLog.createdAt)).limit(50_000);

  const header = [
    "id",
    "createdAt",
    "actorId",
    "actorEmail",
    "action",
    "targetType",
    "targetId",
    "summary",
    "ipAddress",
    "userAgent",
    "meta",
  ];

  const lines = [header.join(",")];
  for (const r of rows) {
    lines.push(
      [
        r.id,
        r.createdAt.toISOString(),
        r.actorId ?? "",
        r.actorEmail ?? "",
        r.action,
        r.targetType ?? "",
        r.targetId ?? "",
        r.summary,
        r.ipAddress ?? "",
        r.userAgent ?? "",
        r.meta ?? "",
      ]
        .map(csvEscape)
        .join(","),
    );
  }
  const body = lines.join("\n");

  await logAudit({
    actorId: Number(me.id),
    actorEmail: me.email,
    action: "download",
    targetType: "audit_log",
    summary: `Exported ${rows.length} audit entries to CSV`,
  });

  const stamp = new Date().toISOString().slice(0, 10);
  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="tru-hyre-audit-${stamp}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
