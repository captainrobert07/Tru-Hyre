"use server";

import { randomBytes } from "crypto";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { candidates, schedulingLinks } from "@/db/schema";
import { requireStaff } from "@/lib/rbac";
import { assertFeatureEnabled } from "@/lib/features";
import { sendEmail } from "@/lib/email";
import { logAudit } from "@/lib/audit";
import { APP_NAME } from "@/lib/utils";

const createSchema = z.object({
  title: z.string().min(2).max(200),
  mode: z.enum(["video", "phone", "onsite"]),
  durationMins: z.coerce.number().int().min(5).max(600).default(45),
  timeZone: z.string().min(1).max(64).default("UTC"),
  jobId: z.coerce.number().int().positive().optional().or(z.literal("")),
  interviewerIds: z.string().optional().or(z.literal("")),
  // newline- or comma-separated "YYYY-MM-DDTHH:mm" wall-clock slots.
  slots: z.string().min(10),
});

/** Convert a wall-clock local datetime + IANA tz to an ISO string with offset. */
function localToIso(local: string, timeZone: string): string {
  const asUtc = new Date(`${local}:00Z`);
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone, hourCycle: "h23",
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
  const parts = dtf.formatToParts(asUtc);
  const get = (t: string) => parts.find((p) => p.type === t)?.value || "00";
  const zoned = Date.UTC(Number(get("year")), Number(get("month")) - 1, Number(get("day")), Number(get("hour")), Number(get("minute")), Number(get("second")));
  const offsetMs = zoned - asUtc.getTime();
  return new Date(asUtc.getTime() - offsetMs).toISOString();
}

export async function createSchedulingLinkAction(
  candidateId: number,
  formData: FormData,
): Promise<{ ok: boolean; url?: string; error?: string }> {
  const user = await requireStaff();
  await assertFeatureEnabled("self_scheduling");
  const parsed = createSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { ok: false, error: "Add a title and at least one proposed slot." };
  const v = parsed.data;

  const cand = (await db.select().from(candidates).where(eq(candidates.id, candidateId)))[0];
  if (!cand) return { ok: false, error: "Candidate not found." };

  const slots = v.slots
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 12)
    .map((local) => localToIso(local, v.timeZone));
  if (slots.length === 0) return { ok: false, error: "Add at least one valid slot (YYYY-MM-DDTHH:mm)." };

  const interviewerIds = (v.interviewerIds || "")
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n) && n > 0);

  const token = randomBytes(24).toString("hex");
  const expires = new Date();
  expires.setDate(expires.getDate() + 14);

  await db.insert(schedulingLinks).values({
    token, candidateId, jobId: v.jobId ? Number(v.jobId) : null,
    title: v.title, mode: v.mode, durationMins: v.durationMins, timeZone: v.timeZone,
    slots, interviewerIds, expiresAt: expires, createdById: Number(user.id),
  });

  const url = `/schedule/${token}`;
  // Email the candidate the link if we have their address.
  if (cand.email) {
    await sendEmail({
      to: cand.email,
      subject: `Pick a time for your interview — ${v.title}`,
      text: `Hi ${cand.fullName.split(/\s+/)[0]},\n\nPlease choose an interview slot that works for you:\n${url}\n\n— ${APP_NAME}`,
    });
  }

  await logAudit({
    actorId: Number(user.id), actorEmail: user.email, action: "create",
    targetType: "candidate", targetId: candidateId,
    summary: `Created self-scheduling link for ${cand.fullName} (${slots.length} slots)`,
  });

  revalidatePath(`/candidates/${candidateId}`);
  return { ok: true, url };
}
