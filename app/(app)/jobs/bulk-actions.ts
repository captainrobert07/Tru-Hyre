"use server";

import { eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { jobs } from "@/db/schema";
import { logAudit } from "@/lib/audit";
import { requireStaff } from "@/lib/rbac";

const STATUSES = ["open", "hold", "closing", "closed"] as const;

const bulkSchema = z.object({
  ids: z.array(z.number().int().positive()).min(1).max(500),
  action: z.enum(["set_status", "delete"]),
  status: z.enum(STATUSES).optional(),
});

export async function bulkJobAction(
  input: unknown,
): Promise<{ ok: true; affected: number } | { ok: false; error: string }> {
  const user = await requireStaff();
  const parsed = bulkSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input." };
  const { ids, action, status } = parsed.data;

  if (action === "set_status") {
    if (!status) return { ok: false, error: "Status required." };
    const result = await db
      .update(jobs)
      .set({ status, updatedAt: new Date() })
      .where(inArray(jobs.id, ids));
    await logAudit({
      actorId: Number(user.id),
      actorEmail: user.email,
      action: "update",
      targetType: "job",
      summary: `Bulk set status=${status} on ${ids.length} jobs`,
    });
    revalidatePath("/jobs");
    return { ok: true, affected: ids.length };
  }

  if (action === "delete") {
    if (user.role !== "admin") return { ok: false, error: "Admin only." };
    await db.delete(jobs).where(inArray(jobs.id, ids));
    await logAudit({
      actorId: Number(user.id),
      actorEmail: user.email,
      action: "delete",
      targetType: "job",
      summary: `Bulk-deleted ${ids.length} jobs`,
    });
    revalidatePath("/jobs");
    return { ok: true, affected: ids.length };
  }

  return { ok: false, error: "Unknown action." };
}
