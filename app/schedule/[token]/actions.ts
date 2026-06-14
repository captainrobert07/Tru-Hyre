"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { schedulingLinks } from "@/db/schema";
import { isFeatureEnabled } from "@/lib/features";
import { scheduleInterview } from "@/lib/interviews";

export type BookResult = { ok: true } | { ok: false; error: string };

/**
 * Public, token-authenticated booking. The token is the only credential — it
 * scopes the action to exactly one candidate's link, so there is no cross-user
 * data exposure: we never accept a candidateId from the client.
 */
export async function bookSlotAction(token: string, formData: FormData): Promise<BookResult> {
  if (!(await isFeatureEnabled("self_scheduling"))) return { ok: false, error: "Scheduling is closed." };

  const link = (await db.select().from(schedulingLinks).where(eq(schedulingLinks.token, token)))[0];
  if (!link) return { ok: false, error: "This link is invalid." };
  if (link.bookedSlot) return { ok: false, error: "This interview has already been booked." };
  if (new Date(link.expiresAt).getTime() < Date.now()) return { ok: false, error: "This link has expired." };

  const chosen = (formData.get("slot") as string) || "";
  if (!link.slots.includes(chosen)) return { ok: false, error: "Pick one of the offered slots." };

  const endIso = new Date(new Date(chosen).getTime() + link.durationMins * 60_000).toISOString();

  // Reuse the same scheduling path staff use (creates Calendar event + emails).
  const result = await scheduleInterview({
    candidateId: link.candidateId,
    submissionId: null,
    jobId: link.jobId,
    title: link.title,
    mode: link.mode,
    startIso: chosen,
    endIso,
    timeZone: link.timeZone,
    location: null,
    interviewerIds: link.interviewerIds || [],
    notes: "Booked by the candidate via self-scheduling link.",
    roundLabel: null,
    actor: { id: link.createdById || 0, email: "self-scheduled", fullName: "Candidate (self-scheduled)" },
  });
  if (!result.ok) return { ok: false, error: result.error };

  await db
    .update(schedulingLinks)
    .set({ bookedSlot: chosen, bookedInterviewId: result.interviewId })
    .where(eq(schedulingLinks.id, link.id));

  revalidatePath(`/schedule/${token}`);
  return { ok: true };
}
