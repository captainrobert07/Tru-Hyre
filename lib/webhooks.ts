import { eq } from "drizzle-orm";
import { db } from "@/db";
import { webhooks } from "@/db/schema";
import { isFeatureEnabled } from "@/lib/features";

/**
 * Fire a domain event to any active webhook subscribed to it. Best-effort and
 * non-blocking semantics: failures are logged, never thrown to the caller.
 * No-op unless the webhooks feature is enabled.
 */
export async function fireWebhook(event: string, payload: Record<string, unknown>): Promise<void> {
  try {
    if (!(await isFeatureEnabled("webhooks"))) return;
    const hooks = await db.select().from(webhooks).where(eq(webhooks.isActive, true));
    const subscribed = hooks.filter((h) => (h.events || []).includes(event));
    if (subscribed.length === 0) return;

    const body = JSON.stringify({ event, payload, at: new Date().toISOString() });
    await Promise.all(
      subscribed.map(async (h) => {
        try {
          const res = await fetch(h.url, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(h.secret ? { "X-Tru-Hyre-Secret": h.secret } : {}),
            },
            body,
          });
          await db.update(webhooks).set({ lastFiredAt: new Date(), lastStatus: String(res.status) }).where(eq(webhooks.id, h.id));
        } catch (e) {
          await db.update(webhooks).set({ lastFiredAt: new Date(), lastStatus: "error" }).where(eq(webhooks.id, h.id));
          console.error("[webhook] delivery failed", h.url, (e as Error).message);
        }
      }),
    );
  } catch (e) {
    console.error("[webhook] fire threw", (e as Error).message);
  }
}
