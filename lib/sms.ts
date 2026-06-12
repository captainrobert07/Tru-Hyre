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

export type SmsResult = { delivered: boolean; reason?: string };

export function smsConfigured(): boolean {
  return Boolean(process.env.SMS_PROVIDER_URL && process.env.SMS_PROVIDER_AUTH && process.env.SMS_FROM);
}

export async function sendSms(to: string, body: string): Promise<SmsResult> {
  if (!smsConfigured()) {
    console.log("[sms] (dev) skipping send →", { to, body: body.slice(0, 40) });
    return { delivered: false, reason: "no_provider" };
  }
  if (!to) return { delivered: false, reason: "no_recipient" };

  try {
    const res = await fetch(process.env.SMS_PROVIDER_URL as string, {
      method: "POST",
      headers: {
        Authorization: process.env.SMS_PROVIDER_AUTH as string,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ To: to, From: process.env.SMS_FROM as string, Body: body.slice(0, 1000) }),
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
