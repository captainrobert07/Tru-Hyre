import { eq } from "drizzle-orm";
import { db } from "@/db";
import { integrations } from "@/db/schema";

/**
 * Integration registry. The catalogue (which integrations exist + their config
 * fields) lives here in code; the values (API keys, etc.) live in the
 * `integrations` table, entered by an admin at /settings/integrations.
 *
 * Resolution order for any field: DB config value → environment variable
 * fallback → undefined. So existing env-based deployments keep working, and an
 * admin can override/supply config at runtime that reflects everywhere.
 */

export type IntegrationField = {
  key: string; // config key, e.g. "apiKey"
  label: string;
  secret?: boolean; // masked in UI, never sent back to client
  envFallback?: string; // env var name to read if config value absent
  placeholder?: string;
  help?: string;
};

export type IntegrationCategory = "AI" | "Email" | "Calendar" | "Storage" | "Messaging" | "Signing" | "HRIS" | "Job boards" | "Telephony" | "Automation" | "Auth" | "Other";

/**
 * Maturity of the integration's *functional* wiring (independent of whether
 * keys are entered):
 *  - "stable": send/use flow is fully wired and exercised in-app.
 *  - "beta":   wired via a generic mechanism (e.g. webhook) but lighter-tested.
 *  - "scaffold": config + Test only; the deep send-flow needs a provider SDK /
 *    OAuth / partner account before it can do real work. Surfaced honestly in
 *    the UI so an admin isn't misled into thinking entering a key "turns it on".
 */
export type IntegrationStatus = "stable" | "beta" | "scaffold";

export type IntegrationDef = {
  key: string;
  label: string;
  category: IntegrationCategory;
  description: string;
  status: IntegrationStatus;
  /** For scaffold integrations: what's still required to make it functional. */
  setupNote?: string;
  fields: IntegrationField[];
};

export const INTEGRATIONS: IntegrationDef[] = [
  {
    key: "anthropic",
    label: "Anthropic (Claude AI)",
    category: "AI",
    description: "Powers all AI features: match scoring, summaries, search, outreach, red-flags.",
    status: "stable",
    fields: [
      { key: "apiKey", label: "API key", secret: true, envFallback: "ANTHROPIC_API_KEY", placeholder: "sk-ant-…" },
      { key: "model", label: "Model", envFallback: "ANTHROPIC_MODEL", placeholder: "claude-haiku-4-5-20251001" },
    ],
  },
  {
    key: "google",
    label: "Google Workspace (Drive + Calendar)",
    category: "Storage",
    description: "Service account for resume/packet storage in Drive and interview Calendar events.",
    status: "stable",
    fields: [
      { key: "serviceAccountJson", label: "Service account JSON (or base64)", secret: true, envFallback: "GOOGLE_SERVICE_ACCOUNT_JSON" },
      { key: "driveFolderId", label: "Drive resumes folder ID", envFallback: "GDRIVE_RESUMES_FOLDER_ID" },
      { key: "calendarImpersonate", label: "Calendar mailbox to impersonate", envFallback: "GCAL_IMPERSONATE_USER", placeholder: "recruitment@allianz.com" },
    ],
  },
  {
    key: "gmail",
    label: "Gmail SMTP",
    category: "Email",
    description: "Sends candidate emails via a shared mailbox (App Password).",
    status: "stable",
    fields: [
      { key: "user", label: "Mailbox", envFallback: "GMAIL_USER", placeholder: "recruitment@allianz.com" },
      { key: "appPassword", label: "App password", secret: true, envFallback: "GMAIL_APP_PASSWORD" },
      { key: "from", label: "From header", envFallback: "EMAIL_FROM", placeholder: "Tru Hyre <recruitment@allianz.com>" },
    ],
  },
  {
    key: "sms",
    label: "SMS / WhatsApp",
    category: "Telephony",
    description: "Sends stage-change texts via a Twilio-style HTTP provider.",
    status: "stable",
    fields: [
      { key: "url", label: "Provider POST URL", envFallback: "SMS_PROVIDER_URL" },
      { key: "auth", label: "Authorization header", secret: true, envFallback: "SMS_PROVIDER_AUTH" },
      { key: "from", label: "Sender id / number", envFallback: "SMS_FROM" },
    ],
  },
  {
    key: "slack",
    label: "Slack / Teams notifications",
    category: "Messaging",
    description: "Posts hiring events to a Slack/Teams incoming webhook.",
    status: "stable",
    fields: [
      { key: "webhookUrl", label: "Incoming webhook URL", secret: true, envFallback: "SLACK_WEBHOOK_URL" },
    ],
  },
  {
    key: "docusign",
    label: "DocuSign (offer e-signatures)",
    category: "Signing",
    description: "Send offer letters for e-signature.",
    status: "scaffold",
    setupNote: "Functional sending needs the DocuSign eSignature API (JWT grant + an envelope template). Enter credentials and Test now; the send-from-offer flow is enabled once a DocuSign developer/partner account is connected.",
    fields: [
      { key: "accountId", label: "Account ID", envFallback: "DOCUSIGN_ACCOUNT_ID" },
      { key: "apiKey", label: "Integration key", secret: true, envFallback: "DOCUSIGN_API_KEY" },
      { key: "baseUrl", label: "Base URL", placeholder: "https://demo.docusign.net" },
    ],
  },
  {
    key: "hris",
    label: "HRIS handoff (Workday/SAP)",
    category: "HRIS",
    description: "POSTs a hire record to your HRIS when a candidate is marked joined.",
    status: "stable",
    fields: [
      { key: "webhookUrl", label: "HRIS endpoint URL", secret: true, envFallback: "HRIS_WEBHOOK_URL" },
      { key: "token", label: "Bearer token", secret: true, envFallback: "HRIS_TOKEN" },
    ],
  },
  {
    key: "outlook",
    label: "Outlook / Microsoft 365 Calendar",
    category: "Calendar",
    description: "Alternative to Google Calendar for interview events.",
    status: "scaffold",
    setupNote: "Needs Microsoft Graph (MSAL client-credentials + Calendars.ReadWrite). Today interview events are created in Google Calendar; Outlook becomes selectable once an Azure app registration is connected.",
    fields: [
      { key: "tenantId", label: "Tenant ID", envFallback: "MS_TENANT_ID" },
      { key: "clientId", label: "Client ID", envFallback: "MS_CLIENT_ID" },
      { key: "clientSecret", label: "Client secret", secret: true, envFallback: "MS_CLIENT_SECRET" },
    ],
  },
  {
    key: "jobboards",
    label: "Job-board posting",
    category: "Job boards",
    description: "POST an open job to one configured endpoint (a Zapier/Make webhook or in-house bridge that relays to LinkedIn / Indeed / Naukri). Avoids three separate partner-API integrations.",
    status: "beta",
    fields: [
      { key: "endpointUrl", label: "Posting endpoint URL", secret: true, envFallback: "JOBBOARD_ENDPOINT_URL", placeholder: "https://hooks.zapier.com/…", help: "We POST a JSON job payload here; your bridge relays it to each board." },
      { key: "authHeader", label: "Authorization header (optional)", secret: true, placeholder: "Bearer …" },
    ],
  },
  {
    key: "zapier",
    label: "Zapier / generic outbound",
    category: "Automation",
    description: "Fire hiring events (candidate created, stage changed, offer accepted) to a Zapier catch hook. Complements native webhooks.",
    status: "stable",
    fields: [
      { key: "catchHookUrl", label: "Catch hook URL", secret: true, envFallback: "ZAPIER_HOOK_URL", help: "Enable the 'Zapier / outbound automation' feature to start firing events here." },
    ],
  },
  {
    key: "transcription",
    label: "Interview transcription",
    category: "AI",
    description: "Transcribe + summarize uploaded interview audio via a provider.",
    status: "scaffold",
    setupNote: "Needs a transcription provider (e.g. Whisper/Deepgram/AssemblyAI) plus an audio-upload step on interviews. Credentials can be stored now; the upload+transcribe flow ships once a provider is chosen.",
    fields: [
      { key: "apiKey", label: "Provider API key", secret: true, envFallback: "TRANSCRIPTION_API_KEY" },
      { key: "url", label: "Provider URL", envFallback: "TRANSCRIPTION_URL" },
    ],
  },
  {
    key: "background_check",
    label: "Background-check provider",
    category: "Other",
    description: "Initiate background checks on candidates via a provider API.",
    status: "scaffold",
    setupNote: "Needs a provider API (e.g. Checkr/HireRight) and a candidate consent + initiate flow. Credentials store now; the initiate-check action ships once a provider account exists.",
    fields: [
      { key: "apiKey", label: "API key", secret: true, envFallback: "BGCHECK_API_KEY" },
      { key: "url", label: "Provider URL", envFallback: "BGCHECK_URL" },
    ],
  },
  {
    key: "sso",
    label: "SSO / 2FA (Azure AD / SAML)",
    category: "Auth",
    description: "Single sign-on via an OIDC/SAML identity provider.",
    status: "scaffold",
    setupNote: "Needs an OIDC/SAML app registration with your IdP and an Auth.js provider wired into auth.ts. Login is via email/password until an IdP is connected.",
    fields: [
      { key: "issuer", label: "Issuer / metadata URL" },
      { key: "clientId", label: "Client ID" },
      { key: "clientSecret", label: "Client secret", secret: true },
    ],
  },
];

const MAP: Record<string, IntegrationDef> = Object.fromEntries(INTEGRATIONS.map((i) => [i.key, i]));

export type ResolvedIntegration = {
  hasRow: boolean;
  enabled: boolean; // admin toggle (true if no row but env present — see below)
  // resolved values (DB → env). Secrets included for server-side use only.
  values: Record<string, string | undefined>;
};

/**
 * Resolve one integration's enabled flag + field values (DB config first, then
 * env fallback). Server-side only — do not pass secret values to the client.
 */
export async function getIntegration(key: string): Promise<ResolvedIntegration> {
  const def = MAP[key];
  const values: Record<string, string | undefined> = {};

  let row: { enabled: boolean; config: Record<string, string> } | undefined;
  try {
    row = (await db.select().from(integrations).where(eq(integrations.key, key)))[0];
  } catch {
    row = undefined; // table may not exist pre-migration
  }

  if (def) {
    for (const f of def.fields) {
      const dbVal = row?.config?.[f.key];
      const envVal = f.envFallback ? process.env[f.envFallback] : undefined;
      values[f.key] = (dbVal && dbVal.length > 0 ? dbVal : undefined) ?? envVal;
    }
  }
  // No row → treat as enabled (so pure-env deployments work). Row → use toggle.
  return { hasRow: Boolean(row), enabled: row ? row.enabled : true, values };
}

/** A single resolved field value (DB → env). */
export async function getIntegrationValue(key: string, field: string): Promise<string | undefined> {
  const r = await getIntegration(key);
  return r.values[field];
}

/**
 * "Ready" = the integration is enabled AND has the required secret configured
 * (DB or env). A feature calls this before attempting any outbound call.
 */
export async function isIntegrationReady(key: string, requiredField: string): Promise<boolean> {
  const r = await getIntegration(key);
  return r.enabled && Boolean(r.values[requiredField]);
}
