import { google, type calendar_v3 } from "googleapis";

/**
 * Google Calendar integration for interview scheduling.
 *
 * Mirrors lib/drive.ts: same service-account JSON, same dev no-op fallback when
 * credentials are absent. The important difference is the `subject` field —
 * a service account owns no calendar of its own, so we use **domain-wide
 * delegation** to impersonate a real Workspace mailbox (the shared recruiting
 * inbox). That mailbox becomes the event organizer, which is what lets Google
 * actually email invites to attendees and mint a Meet link.
 *
 * Required for live operation:
 *   GOOGLE_SERVICE_ACCOUNT_JSON  — same key already used by Drive
 *   GCAL_IMPERSONATE_USER        — the Workspace mailbox to act as
 *                                  (falls back to GMAIL_USER)
 * And in Google Workspace Admin → Security → API controls → domain-wide
 * delegation, the service account's client id must be granted the scope:
 *   https://www.googleapis.com/auth/calendar.events
 */

const SCOPES = ["https://www.googleapis.com/auth/calendar.events"];

let cachedClient: calendar_v3.Calendar | null = null;

function impersonatedUser(): string | null {
  return process.env.GCAL_IMPERSONATE_USER || process.env.GMAIL_USER || null;
}

export function calendarEnabled(): boolean {
  return Boolean(process.env.GOOGLE_SERVICE_ACCOUNT_JSON && impersonatedUser());
}

function getCalendarClient(): calendar_v3.Calendar | null {
  if (cachedClient) return cachedClient;
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  const subject = impersonatedUser();
  if (!raw || !subject) return null;

  let creds: { client_email: string; private_key: string };
  try {
    const decoded = raw.trim().startsWith("{")
      ? raw
      : Buffer.from(raw, "base64").toString("utf-8");
    creds = JSON.parse(decoded);
  } catch (e) {
    console.error("[calendar] failed to parse GOOGLE_SERVICE_ACCOUNT_JSON", (e as Error).message);
    return null;
  }

  // Env pipelines often turn real newlines into the literal "\n" sequence;
  // the JWT silently fails auth if the PEM has no real newlines.
  const privateKey = creds.private_key.replace(/\\n/g, "\n");

  const auth = new google.auth.JWT({
    email: creds.client_email,
    key: privateKey,
    scopes: SCOPES,
    subject, // domain-wide delegation — act as the real recruiting mailbox
  });

  cachedClient = google.calendar({ version: "v3", auth });
  return cachedClient;
}

export type CalendarEventInput = {
  title: string;
  description?: string;
  startIso: string; // ISO 8601 with offset, e.g. 2026-06-20T14:00:00+05:30
  endIso: string;
  timeZone: string; // IANA tz, e.g. "Asia/Kolkata"
  attendees: string[]; // email addresses (candidate + interviewers)
  location?: string | null;
  withMeet: boolean; // mint a Google Meet link (video interviews)
};

export type CalendarEventResult = {
  eventId: string | null;
  meetLink: string | null;
  htmlLink: string | null;
  /** false when credentials are absent — caller should treat as a dev no-op. */
  created: boolean;
};

export async function createCalendarEvent(input: CalendarEventInput): Promise<CalendarEventResult> {
  const calendar = getCalendarClient();
  if (!calendar) {
    console.warn("[calendar] (dev) skipping event create — no credentials", { title: input.title });
    return { eventId: null, meetLink: null, htmlLink: null, created: false };
  }

  const requestBody: calendar_v3.Schema$Event = {
    summary: input.title,
    description: input.description,
    start: { dateTime: input.startIso, timeZone: input.timeZone },
    end: { dateTime: input.endIso, timeZone: input.timeZone },
    attendees: input.attendees.filter(Boolean).map((email) => ({ email })),
    location: input.location || undefined,
  };

  if (input.withMeet) {
    requestBody.conferenceData = {
      createRequest: {
        // Deterministic-ish unique id without Math.random (unavailable here);
        // Google only requires uniqueness per-insert, the timestamp suffices.
        requestId: `truhyre-${Date.parse(input.startIso)}`,
        conferenceSolutionKey: { type: "hangoutsMeet" },
      },
    };
  }

  const res = await calendar.events.insert({
    calendarId: "primary",
    sendUpdates: "all", // email invites to attendees
    conferenceDataVersion: input.withMeet ? 1 : 0,
    requestBody,
  });

  const meetLink =
    res.data.hangoutLink ||
    res.data.conferenceData?.entryPoints?.find((e) => e.entryPointType === "video")?.uri ||
    null;

  return {
    eventId: res.data.id ?? null,
    meetLink,
    htmlLink: res.data.htmlLink ?? null,
    created: true,
  };
}

export async function deleteCalendarEvent(eventId: string | null): Promise<void> {
  if (!eventId) return;
  const calendar = getCalendarClient();
  if (!calendar) return;
  try {
    await calendar.events.delete({
      calendarId: "primary",
      eventId,
      sendUpdates: "all", // notify attendees of the cancellation
    });
  } catch (e) {
    // A 404/410 (already gone) shouldn't block our own cancel flow.
    console.error("[calendar] delete event threw", (e as Error).message);
  }
}
