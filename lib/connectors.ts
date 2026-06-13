import { getIntegration } from "@/lib/integrations";
import { isFeatureEnabled } from "@/lib/features";

/**
 * Outbound connectors that post to external services configured under
 * /settings/integrations. All best-effort and non-throwing — a connector
 * failure never blocks the core action.
 */

/** Post a short message to a Slack/Teams incoming webhook. */
export async function notifySlack(text: string): Promise<void> {
  try {
    if (!(await isFeatureEnabled("slack_notifications"))) return;
    const r = await getIntegration("slack");
    const url = r.values.webhookUrl;
    if (!r.enabled || !url) return;
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
  } catch (e) {
    console.error("[slack] post failed", (e as Error).message);
  }
}

/** POST a hire record to the configured HRIS endpoint. */
export async function pushHrisHire(payload: Record<string, unknown>): Promise<void> {
  try {
    if (!(await isFeatureEnabled("hris_handoff"))) return;
    const r = await getIntegration("hris");
    const url = r.values.webhookUrl;
    const token = r.values.token;
    if (!r.enabled || !url) return;
    await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ event: "candidate.hired", ...payload, at: new Date().toISOString() }),
    });
  } catch (e) {
    console.error("[hris] push failed", (e as Error).message);
  }
}
