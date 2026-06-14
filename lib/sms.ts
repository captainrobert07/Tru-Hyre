/**
 * SMS provider abstraction. Mirrors lib/email.ts: a no-op in dev / when no
 * provider is configured, so callers never break. Supports a generic HTTP
 * provider (Twilio-style) via env vars so no SDK dependency is needed:
 *
 *   SMS_PROVIDER_URL   — POST endpoint (e.g. Twilio Messages API)
 *   SMS_PROVIDER_AUTH  — value for the Authorization header (e.g. "Basic <b64>")
 *   SMS_FROM           — sender id / phone number
 *
 * Without these, sendSms() logs and returns { delivered: false }.
 */

import { getIntegration } from "@/lib/integrations";

export type SmsResult = { delivered: boolean; reason?: string };

export async function smsConfigured(): Promise<boolean> {
  const r = await getIntegration("sms");
  return r.enabled && Boolean(r.values.url && r.values.auth && r.values.from);
}

export async function sendSms(to: string, body: string): Promise<SmsResult> {
  const r = await getIntegration("sms");
  const url = r.values.url, auth = r.values.auth, from = r.values.from;
  if (!r.enabled || !url || !auth || !from) {
    console.log("[sms] (dev) skipping send →", { to, body: body.slice(0, 40) });
    return { delivered: false, reason: "no_provider" };
  }
  if (!to) return { delivered: false, reason: "no_recipient" };

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: auth,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ To: to, From: from, Body: body.slice(0, 1000) }),
      // No default fetch timeout: a hung SMS provider would otherwise stall the
      // stage-change action that awaits this. Fail fast into the catch below.
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      return { delivered: false, reason: `provider_${res.status}` };
    }
    return { delivered: true };
  } catch (e) {
    console.error("[sms] send threw", (e as Error).message);
    return { delivered: false, reason: "exception" };
  }
}
