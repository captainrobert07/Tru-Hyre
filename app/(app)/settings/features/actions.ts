"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { featureFlags } from "@/db/schema";
import { logAudit } from "@/lib/audit";
import { requireAdmin } from "@/lib/rbac";
import { FEATURES, type FeatureKey } from "@/lib/features";

const VALID = new Set<string>(FEATURES.map((f) => f.key));

export async function setFeatureFlagAction(
  key: string,
  enabled: boolean,
): Promise<{ ok: boolean; error?: string }> {
  const user = await requireAdmin();
  if (!VALID.has(key)) return { ok: false, error: "Unknown feature." };

  await db
    .insert(featureFlags)
    .values({ key, enabled, updatedById: Number(user.id), updatedAt: new Date() })
    .onConflictDoUpdate({
      target: featureFlags.key,
      set: { enabled, updatedById: Number(user.id), updatedAt: new Date() },
    });

  const def = FEATURES.find((f) => f.key === (key as FeatureKey));
  await logAudit({
    actorId: Number(user.id),
    actorEmail: user.email,
    action: "update",
    targetType: "feature_flag",
    targetId: key,
    summary: `${enabled ? "Enabled" : "Disabled"} feature: ${def?.label || key}`,
    meta: { key, enabled },
  });

  // Flags affect navigation + many pages; revalidate broadly.
  revalidatePath("/", "layout");
  return { ok: true };
}
