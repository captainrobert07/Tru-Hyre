"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { apiKeys, webhooks } from "@/db/schema";
import { requireAdmin } from "@/lib/rbac";
import { assertFeatureEnabled } from "@/lib/features";
import { generateApiKey } from "@/lib/api-keys";
import { logAudit } from "@/lib/audit";

export async function createApiKeyAction(formData: FormData): Promise<{ ok: boolean; raw?: string; error?: string }> {
  const user = await requireAdmin();
  await assertFeatureEnabled("public_api");
  const name = ((formData.get("name") as string) || "").trim().slice(0, 120);
  if (name.length < 2) return { ok: false, error: "Give the key a name." };

  const { raw, hash, prefix } = generateApiKey();
  await db.insert(apiKeys).values({ name, keyHash: hash, prefix, createdById: Number(user.id) });
  await logAudit({ actorId: Number(user.id), actorEmail: user.email, action: "create", targetType: "api_key", summary: `Created API key "${name}"` });
  revalidatePath("/settings/platform");
  return { ok: true, raw };
}

export async function revokeApiKeyAction(id: number): Promise<{ ok: boolean }> {
  const user = await requireAdmin();
  await assertFeatureEnabled("public_api");
  await db.update(apiKeys).set({ isActive: false }).where(eq(apiKeys.id, id));
  await logAudit({ actorId: Number(user.id), actorEmail: user.email, action: "update", targetType: "api_key", targetId: id, summary: "Revoked API key" });
  revalidatePath("/settings/platform");
  return { ok: true };
}

const webhookSchema = z.object({
  url: z.string().url().max(500),
  events: z.string().optional().or(z.literal("")),
  secret: z.string().max(80).optional().or(z.literal("")),
});

export async function createWebhookAction(formData: FormData): Promise<{ ok: boolean; error?: string }> {
  const user = await requireAdmin();
  await assertFeatureEnabled("webhooks");
  const parsed = webhookSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { ok: false, error: "Enter a valid https URL." };
  const events = (parsed.data.events || "candidate.created,candidate.stage_changed,offer.accepted")
    .split(",").map((s) => s.trim()).filter(Boolean).slice(0, 20);
  await db.insert(webhooks).values({
    url: parsed.data.url,
    events,
    secret: parsed.data.secret || null,
    createdById: Number(user.id),
  });
  await logAudit({ actorId: Number(user.id), actorEmail: user.email, action: "create", targetType: "webhook", summary: `Created webhook → ${parsed.data.url}` });
  revalidatePath("/settings/platform");
  return { ok: true };
}

export async function deleteWebhookAction(id: number): Promise<{ ok: boolean }> {
  const user = await requireAdmin();
  await assertFeatureEnabled("webhooks");
  await db.delete(webhooks).where(eq(webhooks.id, id));
  await logAudit({ actorId: Number(user.id), actorEmail: user.email, action: "delete", targetType: "webhook", targetId: id, summary: "Deleted webhook" });
  revalidatePath("/settings/platform");
  return { ok: true };
}
