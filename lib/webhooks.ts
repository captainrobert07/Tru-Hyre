import { eq } from "drizzle-orm";
import { db } from "@/db";
import { webhooks, candidates } from "@/db/schema";
import { isFeatureEnabled } from "@/lib/features";
import { pushZapier } from "@/lib/connectors";

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
            // Subscriber URLs are arbitrary; without a timeout one hung endpoint
            // stalls the whole Promise.all on the synchronous stage-change path.
            signal: AbortSignal.timeout(8000),
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

/**
 * Fire the `candidate.created` event for a freshly-inserted candidate. Loads
 * the canonical fields by id so every creation path (HR upload, bulk, paste,
 * referral, careers self-apply, CSV import, vendor portal) fires an identical,
 * complete payload. Best-effort — never throws into the caller.
 */
export async function fireCandidateCreated(candidateId: number): Promise<void> {
  try {
    const c = (
      await db
        .select({
          id: candidates.id,
          refId: candidates.refId,
          fullName: candidates.fullName,
          email: candidates.email,
          stage: candidates.stage,
          source: candidates.source,
        })
        .from(candidates)
        .where(eq(candidates.id, candidateId))
    )[0];
    if (!c) return;
    const payload = {
      candidateId: c.id,
      refId: c.refId,
      fullName: c.fullName,
      email: c.email,
      stage: c.stage,
      source: c.source,
    };
    await fireWebhook("candidate.created", payload);
    await pushZapier("candidate.created", payload);
  } catch (e) {
    console.error("[webhook] candidate.created threw", (e as Error).message);
  }
}
