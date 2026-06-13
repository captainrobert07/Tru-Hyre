import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { interviews, candidates, users, notifications, emailOutbox } from "@/db/schema";
import { sendEmail } from "@/lib/email";
import { createCalendarEvent, deleteCalendarEvent } from "@/lib/calendar";
import { logAudit } from "@/lib/audit";
import { APP_NAME } from "@/lib/utils";

export type InterviewMode = "video" | "phone" | "onsite";

export type ScheduleInterviewInput = {
  candidateId: number;
  submissionId: number | null;
  jobId: number | null;
  title: string;
  mode: InterviewMode;
  startIso: string; // ISO 8601 with offset
  endIso: string;
  timeZone: string; // IANA tz
  location: string | null;
  interviewerIds: number[];
  notes: string | null;
  roundLabel?: string | null;
  roundIndex?: number;
  actor: { id: number; email: string; fullName: string };
};

export type ScheduleInterviewResult =
  | { ok: true; interviewId: number; meetLink: string | null; calendarCreated: boolean }
  | { ok: false; error: string };

function fromAddress(): string {
  if (process.env.EMAIL_FROM) return process.env.EMAIL_FROM;
  if (process.env.GMAIL_USER) return process.env.GMAIL_USER;
  return "noreply@truhyre.app";
}

function firstName(fullName: string): string {
  return fullName.split(/\s+/)[0] || fullName;
}

function fmtWhen(startIso: string, timeZone: string): string {
  try {
    return new Intl.DateTimeFormat("en-GB", {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZone,
      timeZoneName: "short",
    }).format(new Date(startIso));
  } catch {
    return startIso;
  }
}

const MODE_LABEL: Record<InterviewMode, string> = {
  video: "Video call",
  phone: "Phone call",
  onsite: "On-site",
};

function buildCandidateEmail(opts: {
  candidateName: string;
  title: string;
  mode: InterviewMode;
  when: string;
  meetLink: string | null;
  location: string | null;
}): { subject: string; text: string; html: string } {
  const { candidateName, title, mode, when, meetLink, location } = opts;
  const where =
    mode === "video"
      ? meetLink
        ? `Join link: ${meetLink}`
        : "A video-call link will follow."
      : mode === "phone"
        ? "We'll call you at the number on file."
        : location
          ? `Location: ${location}`
          : "Location details to follow.";

  const subject = `Interview scheduled: ${title}`;
  const text =
    `Hi ${firstName(candidateName)},\n\n` +
    `Your interview has been scheduled.\n\n` +
    `• What: ${title}\n` +
    `• Format: ${MODE_LABEL[mode]}\n` +
    `• When: ${when}\n` +
    `• ${where}\n\n` +
    `A calendar invitation has been sent separately. Please accept it to confirm.\n\n` +
    `— ${APP_NAME}`;

  const safe = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] || c));
  const linkHtml =
    mode === "video" && meetLink
      ? `<p style="margin:0 0 8px"><strong>Join:</strong> <a href="${safe(meetLink)}">${safe(meetLink)}</a></p>`
      : `<p style="margin:0 0 8px">${safe(where)}</p>`;

  const html = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'SF Pro Text',Inter,sans-serif;color:#0f172a;max-width:480px;margin:0 auto;padding:24px">
      <h1 style="font-size:20px;margin:0 0 6px">Interview scheduled</h1>
      <p style="color:#475569;font-size:14px;margin:0 0 18px">Hi ${safe(firstName(candidateName))}, here are the details.</p>
      <table style="font-size:14px;border-collapse:collapse;margin:0 0 16px">
        <tr><td style="padding:2px 12px 2px 0;color:#94a3b8">What</td><td><strong>${safe(title)}</strong></td></tr>
        <tr><td style="padding:2px 12px 2px 0;color:#94a3b8">Format</td><td>${MODE_LABEL[mode]}</td></tr>
        <tr><td style="padding:2px 12px 2px 0;color:#94a3b8">When</td><td>${safe(when)}</td></tr>
      </table>
      ${linkHtml}
      <p style="font-size:12px;color:#94a3b8;margin:18px 0 0">A calendar invitation has been sent separately — please accept it to confirm.</p>
      <p style="font-size:12px;color:#94a3b8;margin:8px 0 0">— ${APP_NAME}</p>
    </div>`;

  return { subject, text, html };
}

/**
 * Schedule an interview: create the Calendar event (Meet link for video),
 * persist the interview row, email the candidate, and notify interviewers.
 * Calendar/email failures are non-fatal — the interview row is always written
 * so the schedule is recorded even when Google/SMTP creds are absent (dev).
 */
export async function scheduleInterview(input: ScheduleInterviewInput): Promise<ScheduleInterviewResult> {
  const cand = (await db.select().from(candidates).where(eq(candidates.id, input.candidateId)))[0];
  if (!cand) return { ok: false, error: "Candidate not found." };

  const interviewerIds = Array.from(new Set(input.interviewerIds)).filter((n) => Number.isFinite(n));
  const interviewers = interviewerIds.length
    ? await db.select({ id: users.id, email: users.email, fullName: users.fullName }).from(users).where(inArray(users.id, interviewerIds))
    : [];

  const attendees = [cand.email, ...interviewers.map((i) => i.email)].filter((e): e is string => Boolean(e));
  const when = fmtWhen(input.startIso, input.timeZone);

  // 1. Calendar event (best-effort).
  let cal = { eventId: null as string | null, meetLink: null as string | null, created: false };
  try {
    const r = await createCalendarEvent({
      title: input.title,
      description: input.notes || `Interview for ${cand.fullName} (${cand.refId}).`,
      startIso: input.startIso,
      endIso: input.endIso,
      timeZone: input.timeZone,
      attendees,
      location: input.location,
      withMeet: input.mode === "video",
    });
    cal = { eventId: r.eventId, meetLink: r.meetLink, created: r.created };
  } catch (e) {
    console.error("[interviews] calendar event failed — recording interview anyway", (e as Error).message);
  }

  // 2. Persist interview row.
  const [created] = await db
    .insert(interviews)
    .values({
      candidateId: input.candidateId,
      submissionId: input.submissionId,
      jobId: input.jobId,
      title: input.title,
      mode: input.mode,
      scheduledStart: new Date(input.startIso),
      scheduledEnd: new Date(input.endIso),
      location: input.location,
      meetLink: cal.meetLink,
      googleEventId: cal.eventId,
      interviewerIds,
      roundLabel: input.roundLabel || null,
      roundIndex: input.roundIndex && input.roundIndex > 0 ? input.roundIndex : 1,
      status: "scheduled",
      notes: input.notes,
      createdById: input.actor.id,
    })
    .returning({ id: interviews.id });

  // 3. Email the candidate (best-effort, logged to outbox for the comms timeline).
  if (cand.email) {
    const mail = buildCandidateEmail({
      candidateName: cand.fullName,
      title: input.title,
      mode: input.mode,
      when,
      meetLink: cal.meetLink,
      location: input.location,
    });
    try {
      const result = await sendEmail({ to: cand.email, subject: mail.subject, text: mail.text, html: mail.html });
      await db.insert(emailOutbox).values({
        candidateId: input.candidateId,
        templateSlug: "interview:scheduled",
        toEmail: cand.email,
        fromEmail: fromAddress(),
        subject: mail.subject,
        bodyHtml: mail.html,
        bodyText: mail.text,
        status: result.delivered ? "sent" : "failed",
        error: result.delivered ? null : (result.reason || "unknown"),
        sentAt: result.delivered ? new Date() : null,
        triggeredById: input.actor.id,
      });
    } catch (e) {
      console.error("[interviews] candidate email failed", (e as Error).message);
    }
  }

  // 4. Notify interviewers in-app.
  if (interviewers.length) {
    await db.insert(notifications).values(
      interviewers.map((i) => ({
        userId: i.id,
        kind: "interview" as const,
        title: `Interview: ${cand.fullName}`,
        body: `${input.title} — ${when}`,
        url: `/candidates/${input.candidateId}`,
      })),
    );
  }

  // 5. Audit.
  await logAudit({
    actorId: input.actor.id,
    actorEmail: input.actor.email,
    action: "interview_schedule",
    targetType: "candidate",
    targetId: input.candidateId,
    summary: `Scheduled interview "${input.title}" for ${cand.fullName} (${when})`,
    meta: {
      interviewId: created.id,
      mode: input.mode,
      calendarCreated: cal.created,
      interviewerCount: interviewers.length,
    },
  });

  return { ok: true, interviewId: created.id, meetLink: cal.meetLink, calendarCreated: cal.created };
}

export async function cancelInterview(
  interviewId: number,
  actor: { id: number; email: string; fullName: string },
): Promise<{ ok: boolean; error?: string }> {
  const iv = (await db.select().from(interviews).where(eq(interviews.id, interviewId)))[0];
  if (!iv) return { ok: false, error: "Interview not found." };
  if (iv.status === "cancelled") return { ok: true };

  await deleteCalendarEvent(iv.googleEventId);

  await db
    .update(interviews)
    .set({ status: "cancelled", updatedAt: new Date() })
    .where(eq(interviews.id, interviewId));

  await logAudit({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "interview_cancel",
    targetType: "candidate",
    targetId: iv.candidateId,
    summary: `Cancelled interview "${iv.title}"`,
    meta: { interviewId },
  });

  return { ok: true };
}
