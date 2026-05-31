import { headers } from "next/headers";
import { db } from "@/db";
import { auditLog } from "@/db/schema";

type AuditAction =
  | "create" | "update" | "delete" | "login" | "logout"
  | "view" | "download" | "submit" | "feedback" | "invite" | "role_change"
  | "email_send" | "template_edit";

export async function logAudit(input: {
  actorId?: number | null;
  actorEmail?: string | null;
  action: AuditAction;
  targetType?: string;
  targetId?: string | number;
  summary: string;
  meta?: Record<string, unknown>;
}) {
  const h = await headers();
  const ipAddress = h.get("x-forwarded-for")?.split(",")[0].trim() || h.get("x-real-ip") || null;
  const userAgent = h.get("user-agent") || null;

  await db.insert(auditLog).values({
    actorId: input.actorId ?? null,
    actorEmail: input.actorEmail ?? null,
    action: input.action,
    targetType: input.targetType,
    targetId: input.targetId !== undefined ? String(input.targetId) : undefined,
    summary: input.summary,
    meta: input.meta,
    ipAddress: ipAddress?.slice(0, 64),
    userAgent: userAgent?.slice(0, 254),
  });
}
