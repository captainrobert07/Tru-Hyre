"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { integrations } from "@/db/schema";
import { requireAdmin } from "@/lib/rbac";
import { INTEGRATIONS } from "@/lib/integrations";
import { testIntegration, type TestResult } from "@/lib/integration-test";
import { logAudit } from "@/lib/audit";

const MAP = Object.fromEntries(INTEGRATIONS.map((i) => [i.key, i]));
const MASK = "••••••••"; // sentinel: secret field left unchanged

/**
 * Save an integration's enabled flag + config. Secret fields submitted as the
 * mask sentinel (unchanged) keep their stored value; empty non-secret fields
 * are cleared. Never logs secret values.
 */
export async function saveIntegrationAction(
  key: string,
  formData: FormData,
): Promise<{ ok: boolean; error?: string }> {
  const user = await requireAdmin();
  const def = MAP[key];
  if (!def) return { ok: false, error: "Unknown integration." };

  const existing = (await db.select().from(integrations).where(eq(integrations.key, key)))[0];
  const prevConfig = existing?.config || {};
  const next: Record<string, string> = { ...prevConfig };

  for (const f of def.fields) {
    const raw = (formData.get(`field_${f.key}`) as string | null) ?? "";
    const val = raw.trim();
    if (f.secret) {
      if (val === MASK || val === "") {
        // unchanged — keep existing (don't wipe a secret on empty submit)
        continue;
      }
      next[f.key] = val;
    } else {
      if (val === "") delete next[f.key];
      else next[f.key] = val;
    }
  }

  const enabled = formData.get("enabled") === "on";

  await db
    .insert(integrations)
    .values({ key, enabled, config: next, updatedById: Number(user.id), updatedAt: new Date() })
    .onConflictDoUpdate({
      target: integrations.key,
      set: { enabled, config: next, updatedById: Number(user.id), updatedAt: new Date() },
    });

  await logAudit({
    actorId: Number(user.id),
    actorEmail: user.email,
    action: "update",
    targetType: "integration",
    targetId: key,
    summary: `${enabled ? "Enabled" : "Disabled"} integration ${def.label}`,
    meta: { key, enabled, fieldsSet: Object.keys(next).length },
  });

  revalidatePath("/settings/integrations");
  return { ok: true };
}

/** Live connectivity test for an integration (admin-only). */
export async function testIntegrationAction(key: string): Promise<TestResult> {
  await requireAdmin();
  if (!MAP[key]) return { ok: false, message: "Unknown integration." };
  return testIntegration(key);
}
