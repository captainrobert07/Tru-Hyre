import { getIntegration } from "@/lib/integrations";
import { isFeatureEnabled } from "@/lib/features";

/**
 * Outbound connectors that post to external services configured under
 * /settings/integrations. All best-effort and non-throwing — a connector
 * failure never blocks the core action.
 *
 * Every outbound fetch carries an explicit timeout. notifySlack / pushHrisHire
 * / pushZapier are awaited synchronously inside the stage-change action, and a
 * plain fetch has NO default timeout — a hung webhook endpoint would otherwise
 * stall the recruiter's stage change until the platform function timeout (and
 * a try/catch does not catch slowness). AbortSignal.timeout makes a hang fail
 * fast into the existing catch instead.
 */
const CONNECTOR_TIMEOUT_MS = 8000;

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
      signal: AbortSignal.timeout(CONNECTOR_TIMEOUT_MS),
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
      signal: AbortSignal.timeout(CONNECTOR_TIMEOUT_MS),
    });
  } catch (e) {
    console.error("[hris] push failed", (e as Error).message);
  }
}

/**
 * Fire a hiring event to the configured Zapier catch-hook. Complements native
 * webhooks: native webhooks deliver to subscriber-defined URLs, this delivers
 * the same domain events to a single Zapier zap so non-technical admins can
 * build downstream automations without managing webhook rows. Best-effort.
 */
export async function pushZapier(event: string, payload: Record<string, unknown>): Promise<void> {
  try {
    if (!(await isFeatureEnabled("zapier_automation"))) return;
    const r = await getIntegration("zapier");
    const url = r.values.catchHookUrl;
    if (!r.enabled || !url) return;
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event, ...payload, at: new Date().toISOString() }),
      signal: AbortSignal.timeout(CONNECTOR_TIMEOUT_MS),
    });
  } catch (e) {
    console.error("[zapier] push failed", (e as Error).message);
  }
}

/**
 * Post an open job to the configured job-board endpoint. We deliberately POST
 * to ONE configured URL (a Zapier/Make webhook or an in-house bridge that
 * relays to LinkedIn/Indeed/Naukri) rather than embedding three partner-API
 * clients that each need OAuth + a partner account. Returns a result so the
 * caller can surface success/failure (unlike the fire-and-forget notifiers).
 */
export async function postJobToBoard(payload: Record<string, unknown>): Promise<{ ok: boolean; message: string }> {
  if (!(await isFeatureEnabled("job_board_posting"))) {
    return { ok: false, message: "Job-board posting is disabled." };
  }
  const r = await getIntegration("jobboards");
  const url = r.values.endpointUrl;
  if (!r.enabled || !url) {
    return { ok: false, message: "No job-board endpoint configured (set it under Integrations)." };
  }
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(r.values.authHeader ? { Authorization: r.values.authHeader } : {}),
      },
      body: JSON.stringify({ event: "job.post", ...payload, at: new Date().toISOString() }),
      signal: AbortSignal.timeout(CONNECTOR_TIMEOUT_MS),
    });
    if (res.status >= 500) return { ok: false, message: `Endpoint error (HTTP ${res.status}).` };
    return { ok: true, message: `Posted (HTTP ${res.status}).` };
  } catch (e) {
    return { ok: false, message: `Unreachable: ${(e as Error).message.slice(0, 100)}` };
  }
}
