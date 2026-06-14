# Integrations — status & what each needs

Configure all of these at **Settings → Integrations** (admin only). Keys entered
there are stored in the `integrations` table, override environment variables, and
apply everywhere. Each integration shows a live **Test connection** result and a
maturity badge.

Maturity levels:
- **stable** — the functional send/use flow is fully wired and exercised in-app.
- **beta** — wired via a generic mechanism (webhook), lighter-tested.
- **scaffold** — config + Test only; the deep send-flow needs a provider SDK /
  OAuth / partner account before it does real work. Entering a key does **not**
  silently "turn it on" — the UI says so.

## Stable (works once keys are entered)

| Integration | What it does | Required keys |
|---|---|---|
| **Anthropic (Claude)** | All AI features (match, summary, search, outreach, red-flags, offer prediction) | `apiKey` (+ optional `model`) |
| **Google Workspace** | Drive resume/packet storage + Calendar interview events | `serviceAccountJson`, `driveFolderId`, `calendarImpersonate` |
| **Gmail SMTP** | Outbound candidate email (shared mailbox) | `user`, `appPassword`, `from` |
| **SMS / WhatsApp** | Stage-change texts via Twilio-style HTTP provider | `url`, `auth`, `from` |
| **Slack / Teams** | Posts hiring events to an incoming webhook | `webhookUrl` |
| **HRIS handoff** | POSTs a hire record on →joined | `webhookUrl`, `token` |
| **Zapier / outbound** | Fires `candidate.created` / `candidate.stage_changed` / `offer.accepted` to a catch-hook. Enable the **Zapier / outbound automation** feature to start firing. | `catchHookUrl` |

## Beta

| Integration | What it does | Required keys | Notes |
|---|---|---|---|
| **Job-board posting** | "Post to job board" on an open job POSTs a board-agnostic JSON payload to one configured endpoint | `endpointUrl` (+ optional `authHeader`) | Point it at a Zapier/Make webhook or in-house bridge that relays to LinkedIn/Indeed/Naukri. Enable the **Job-board posting** feature. |

## Scaffold (need provider setup before functional)

These store credentials and pass a basic Test, but the real send/use flow is
intentionally **not** wired blind — each needs a provider SDK + OAuth/partner
account. The UI shows a "Scaffold" badge and the setup note below.

| Integration | To make functional |
|---|---|
| **DocuSign** | DocuSign eSignature API (JWT grant + envelope template). Then wire a "Send for signature" action on the offer panel using the stored `accountId`/`apiKey`/`baseUrl`. |
| **Outlook / M365 Calendar** | Microsoft Graph via MSAL (client-credentials, `Calendars.ReadWrite`). Then make the interview scheduler offer Outlook as an alternative to Google Calendar. |
| **Interview transcription** | A provider (Whisper/Deepgram/AssemblyAI) + an audio-upload step on interviews. Then call the provider and store the transcript/summary. |
| **Background-check** | A provider API (Checkr/HireRight) + candidate consent + initiate flow. |
| **SSO / 2FA** | An OIDC/SAML app registration with your IdP + an Auth.js provider added to `auth.ts`. Login is email/password until then. |

## Why job boards are one endpoint, not three

LinkedIn, Indeed, and Naukri each require a separate partner account and OAuth
app. Rather than ship three unverifiable API clients, Tru Hyre POSTs a single
clean job payload to **one** endpoint you control (a Zapier/Make zap or in-house
relay). This is real and testable today, and you can fan out to any board from
that one hook without code changes here.
