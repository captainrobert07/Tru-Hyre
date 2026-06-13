import { createHash, randomBytes } from "crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { apiKeys } from "@/db/schema";

/** Generate a new raw API key + its stored hash/prefix. Raw is shown once. */
export function generateApiKey(): { raw: string; hash: string; prefix: string } {
  const raw = `thk_${randomBytes(24).toString("hex")}`;
  const hash = createHash("sha256").update(raw).digest("hex");
  const prefix = raw.slice(0, 12);
  return { raw, hash, prefix };
}

export function hashApiKey(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

/** Validate a bearer token against active API keys. Returns true if valid. */
export async function verifyApiKey(raw: string | null): Promise<boolean> {
  return Boolean(await verifyApiKeyRow(raw));
}

/**
 * Validate a bearer token and return the matched key row (id + prefix) for
 * audit logging, or null if invalid/revoked. Stamps lastUsedAt best-effort.
 */
export async function verifyApiKeyRow(raw: string | null): Promise<{ id: number; prefix: string } | null> {
  if (!raw) return null;
  const hash = hashApiKey(raw.trim());
  const row = (await db.select().from(apiKeys).where(eq(apiKeys.keyHash, hash)))[0];
  if (!row || !row.isActive) return null;
  try {
    await db.update(apiKeys).set({ lastUsedAt: new Date() }).where(eq(apiKeys.id, row.id));
  } catch {
    // ignore — don't block the request on the stamp
  }
  return { id: row.id, prefix: row.prefix };
}
