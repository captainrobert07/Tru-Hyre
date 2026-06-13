import { getIntegration } from "@/lib/integrations";

/**
 * Live connectivity checks per integration. Each returns a green/red result an
 * admin sees right after entering a key at /settings/integrations — the core of
 * a safe live cutover. All checks are read-only / non-mutating where possible.
 */

export type TestResult = { ok: boolean; message: string };

async function testAnthropic(): Promise<TestResult> {
  const r = await getIntegration("anthropic");
  const key = r.values.apiKey;
  if (!key) return { ok: false, message: "No API key set." };
  try {
    // Minimal 1-token call confirms auth + model validity.
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model: r.values.model || "claude-haiku-4-5-20251001", max_tokens: 1, messages: [{ role: "user", content: "hi" }] }),
    });
    if (res.ok) return { ok: true, message: "Authenticated — Claude responded." };
    if (res.status === 401) return { ok: false, message: "Invalid API key (401)." };
    if (res.status === 404) return { ok: false, message: "Model not found — check the model id." };
    return { ok: false, message: `Anthropic returned ${res.status}.` };
  } catch (e) {
    return { ok: false, message: `Network error: ${(e as Error).message}` };
  }
}

async function testGmail(): Promise<TestResult> {
  const r = await getIntegration("gmail");
  const user = r.values.user;
  const pass = r.values.appPassword?.replace(/\s/g, "");
  if (!user || !pass) return { ok: false, message: "Mailbox or app password missing." };
  try {
    const nodemailer = (await import("nodemailer")).default;
    const transport = nodemailer.createTransport({
      host: "smtp.gmail.com", port: 465, secure: true,
      auth: { user, pass }, connectionTimeout: 8000, socketTimeout: 8000,
    });
    await transport.verify(); // SMTP handshake + auth, sends nothing
    return { ok: true, message: `SMTP authenticated as ${user}.` };
  } catch (e) {
    return { ok: false, message: `SMTP failed: ${(e as Error).message.slice(0, 120)}` };
  }
}

async function testGoogle(): Promise<TestResult> {
  const r = await getIntegration("google");
  const raw = r.values.serviceAccountJson;
  if (!raw) return { ok: false, message: "Service account JSON missing." };
  try {
    const decoded = raw.trim().startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf-8");
    const creds = JSON.parse(decoded) as { client_email?: string; private_key?: string };
    if (!creds.client_email || !creds.private_key) return { ok: false, message: "JSON parsed but missing client_email/private_key." };
    const { google } = await import("googleapis");
    const auth = new google.auth.JWT({
      email: creds.client_email,
      key: creds.private_key.replace(/\\n/g, "\n"),
      scopes: ["https://www.googleapis.com/auth/drive.file"],
    });
    await auth.authorize(); // real token exchange with Google
    const folder = r.values.driveFolderId;
    return { ok: true, message: `Service account authorized${folder ? "" : " (set a Drive folder id to store resumes)"}.` };
  } catch (e) {
    return { ok: false, message: `Google auth failed: ${(e as Error).message.slice(0, 120)}` };
  }
}

async function testWebhookUrl(key: string, field: string, label: string): Promise<TestResult> {
  const r = await getIntegration(key);
  const url = r.values[field];
  if (!url) return { ok: false, message: `${label} URL missing.` };
  try {
    // Lightweight reachability ping (does not assume the endpoint accepts our body).
    const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ type: "truhyre.test" }) });
    return { ok: res.status < 500, message: `Endpoint reachable (HTTP ${res.status}).` };
  } catch (e) {
    return { ok: false, message: `Unreachable: ${(e as Error).message.slice(0, 100)}` };
  }
}

async function testGenericHttp(key: string): Promise<TestResult> {
  // For providers we only store credentials for (DocuSign, HRIS, SMS, etc.):
  // confirm the required secret is present; a deep call needs provider-specific
  // flows we invoke at use-time.
  const r = await getIntegration(key);
  const hasSecret = Object.values(r.values).some((v) => v && v.length > 0);
  return hasSecret
    ? { ok: true, message: "Credentials saved. Functional check runs when the feature is used." }
    : { ok: false, message: "No credentials saved yet." };
}

export async function testIntegration(key: string): Promise<TestResult> {
  switch (key) {
    case "anthropic": return testAnthropic();
    case "gmail": return testGmail();
    case "google": return testGoogle();
    case "slack": return testWebhookUrl("slack", "webhookUrl", "Slack webhook");
    case "hris": return testWebhookUrl("hris", "webhookUrl", "HRIS");
    case "zapier": return testWebhookUrl("zapier", "catchHookUrl", "Zapier hook");
    default: return testGenericHttp(key);
  }
}
