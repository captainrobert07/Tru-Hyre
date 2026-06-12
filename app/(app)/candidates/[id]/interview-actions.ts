"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireStaff } from "@/lib/rbac";
import { assertFeatureEnabled } from "@/lib/features";
import { scheduleInterview, cancelInterview, type InterviewMode } from "@/lib/interviews";

const scheduleSchema = z.object({
  title: z.string().min(2).max(200),
  mode: z.enum(["video", "phone", "onsite"]),
  // datetime-local value, e.g. "2026-06-20T14:00", interpreted in `timeZone`.
  start: z.string().min(10),
  durationMins: z.coerce.number().int().min(5).max(600).default(45),
  timeZone: z.string().min(1).max(64).default("UTC"),
  location: z.string().max(400).optional().or(z.literal("")),
  submissionId: z.coerce.number().int().positive().optional().or(z.literal("")),
  jobId: z.coerce.number().int().positive().optional().or(z.literal("")),
  interviewerIds: z.string().optional().or(z.literal("")),
  notes: z.string().max(2000).optional().or(z.literal("")),
});

/**
 * Convert a wall-clock "datetime-local" string + IANA tz into an ISO 8601
 * string carrying that zone's UTC offset, so Google interprets it correctly.
 * Uses Intl to derive the offset for the given instant (handles DST).
 */
function localToIsoWithOffset(local: string, timeZone: string): string {
  // Treat the local string as the wall-clock time in `timeZone`.
  const asUtc = new Date(`${local}:00Z`); // pretend it's UTC to get a baseline
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
  const parts = dtf.formatToParts(asUtc);
  const get = (t: string) => parts.find((p) => p.type === t)?.value || "00";
  // The zoned rendering of our baseline UTC instant:
  const zoned = Date.UTC(
    Number(get("year")), Number(get("month")) - 1, Number(get("day")),
    Number(get("hour")), Number(get("minute")), Number(get("second")),
  );
  // offsetMs = how far the zone is from UTC for this instant.
  const offsetMs = zoned - asUtc.getTime();
  // The true UTC instant for the wall-clock time the user picked:
  const trueUtc = new Date(asUtc.getTime() - offsetMs);
  return trueUtc.toISOString();
}

export async function scheduleInterviewAction(
  candidateId: number,
  formData: FormData,
): Promise<{ ok: boolean; error?: string; meetLink?: string | null }> {
  const user = await requireStaff();
  await assertFeatureEnabled("interviews");
  const parsed = scheduleSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { ok: false, error: "Please fill in the interview title and time." };
  const v = parsed.data;

  const startIso = localToIsoWithOffset(v.start, v.timeZone);
  const endIso = new Date(new Date(startIso).getTime() + v.durationMins * 60_000).toISOString();

  const interviewerIds = (v.interviewerIds || "")
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n) && n > 0);

  const result = await scheduleInterview({
    candidateId,
    submissionId: v.submissionId ? Number(v.submissionId) : null,
    jobId: v.jobId ? Number(v.jobId) : null,
    title: v.title,
    mode: v.mode as InterviewMode,
    startIso,
    endIso,
    timeZone: v.timeZone,
    location: v.location || null,
    interviewerIds,
    notes: v.notes || null,
    actor: { id: Number(user.id), email: user.email, fullName: user.fullName },
  });

  revalidatePath(`/candidates/${candidateId}`);
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, meetLink: result.meetLink };
}

export async function cancelInterviewAction(
  candidateId: number,
  interviewId: number,
): Promise<{ ok: boolean; error?: string }> {
  const user = await requireStaff();
  await assertFeatureEnabled("interviews");
  const r = await cancelInterview(interviewId, {
    id: Number(user.id),
    email: user.email,
    fullName: user.fullName,
  });
  revalidatePath(`/candidates/${candidateId}`);
  return r;
}
