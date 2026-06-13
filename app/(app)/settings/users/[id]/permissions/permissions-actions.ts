"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { userPermissions } from "@/db/schema";
import { requireAdmin } from "@/lib/rbac";
import { assertFeatureEnabled } from "@/lib/features";
import { isValidPermissionKey } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
import { withToast } from "@/lib/toast";

export async function setUserPermissionsAction(userId: number, formData: FormData): Promise<void> {
  await assertFeatureEnabled("granular_permissions");
  const me = await requireAdmin();
  const perms = (formData.getAll("permissions") as string[]).filter(isValidPermissionKey);

  await db
    .insert(userPermissions)
    .values({ userId, permissions: perms, updatedById: Number(me.id), updatedAt: new Date() })
    .onConflictDoUpdate({
      target: userPermissions.userId,
      set: { permissions: perms, updatedById: Number(me.id), updatedAt: new Date() },
    });

  await logAudit({
    actorId: Number(me.id),
    actorEmail: me.email,
    action: "update",
    targetType: "user_permissions",
    targetId: userId,
    summary: `Updated permissions for user #${userId} (${perms.length} grants)`,
    meta: { permissions: perms },
  });

  revalidatePath(`/settings/users/${userId}/permissions`);
  redirect(withToast(`/settings/users/${userId}/permissions`, "Permissions saved"));
}
