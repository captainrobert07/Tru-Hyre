"use server";

import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { jobs, candidates, stageHistory, notifications, users } from "@/db/schema";
import { makeRefId } from "@/lib/refid";
import { isFeatureEnabled } from "@/lib/features";
import { logAudit } from "@/lib/audit";
import { fireCandidateCreated } from "@/lib/webhooks";

const referSchema = z.object({
  jobId: z.coerce.number().int().positive().optional().or(z.literal("")),
  referrerName: z.string().min(2).max(120),
  referrerEmail: z.string().email().max(254),
  fullName: z.string().min(2).max(200),
  email: z.string().email().max(254),
  phone: z.string().max(40).optional().or(z.literal("")),
  note: z.string().max(1000).optional().or(z.literal("")),
  website: z.string().max(0).optional().or(z.literal("")), // honeypot
});

export type ReferResult = { ok: true } | { ok: false; error: string };

export async function submitReferralAction(_prev: ReferResult | null, formData: FormData): Promise<ReferResult> {
  if (!(await isFeatureEnabled("referral_portal"))) return { ok: false, error: "Referrals are closed." };

  const parsed = referSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { ok: false, error: "Please fill in your details and the candidate's name + email." };
  const v = parsed.data;
  if (v.website) return { ok: true }; // honeypot

  const jobId = v.jobId ? Number(v.jobId) : null;
  let jobTitle: string | null = null;
  if (jobId) {
    const job = (await db.select({ title: jobs.title }).from(jobs).where(eq(jobs.id, jobId)))[0];
    jobTitle = job?.title ?? null;
  }

  const refId = makeRefId();
  const [created] = await db
    .insert(candidates)
    .values({
      refId,
      fullName: v.fullName,
      email: v.email,
      phone: v.phone || null,
      stage: "hr_review",
      parseStatus: "pending",
      source: "referral",
      sourceDetail: `Referred by ${v.referrerName} (${v.referrerEmail})${jobTitle ? ` for ${jobTitle}` : ""}`,
      tags: ["referral"],
      notes: v.note ? `Referral note: ${v.note}` : null,
    })
    .returning({ id: candidates.id });

  await db.insert(stageHistory).values({
    candidateId: created.id,
    fromStage: null,
    toStage: "hr_review",
    note: `Referred by ${v.referrerName}${jobTitle ? ` for ${jobTitle}` : ""}`,
  });

  const recipients = (await db.select({ id: users.id }).from(users).where(eq(users.role, "hr"))).map((u) => u.id);
  if (recipients.length) {
    await db.insert(notifications).values(
      recipients.map((userId) => ({
        userId,
        kind: "system" as const,
        title: `Referral: ${v.fullName}`,
        body: `${v.referrerName} referred a candidate${jobTitle ? ` for ${jobTitle}` : ""}.`,
        url: `/candidates/${created.id}`,
      })),
    );
  }

  await logAudit({
    action: "create",
    targetType: "candidate",
    targetId: created.id,
    summary: `Referral: ${v.fullName} by ${v.referrerName}`,
    meta: { refId, jobId, source: "referral" },
  });

  await fireCandidateCreated(created.id);

  return { ok: true };
}
