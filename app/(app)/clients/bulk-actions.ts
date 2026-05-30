"use server";

import { inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { clientAccounts } from "@/db/schema";
import { logAudit } from "@/lib/audit";
import { requireAdmin } from "@/lib/rbac";

const schema = z.object({
  ids: z.array(z.number().int().positive()).min(1).max(200),
  action: z.literal("delete"),
});

export async function bulkClientAction(
  input: unknown,
): Promise<{ ok: true; affected: number } | { ok: false; error: string }> {
  const user = await requireAdmin();
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input." };
  await db.delete(clientAccounts).where(inArray(clientAccounts.id, parsed.data.ids));
  await logAudit({
    actorId: Number(user.id),
    actorEmail: user.email,
    action: "delete",
    targetType: "client",
    summary: `Bulk-deleted ${parsed.data.ids.length} clients`,
  });
  revalidatePath("/clients");
  return { ok: true, affected: parsed.data.ids.length };
}
