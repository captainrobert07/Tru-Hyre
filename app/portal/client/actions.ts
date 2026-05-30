"use server";

import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { submissions, feedbackEvents, candidates, jobs, users, notifications } from "@/db/schema";
import { logAudit } from "@/lib/audit";
import { requireClient } from "@/lib/rbac";

const feedbackSchema = z.object({
  kind: z.enum(["shortlist", "reject", "interview", "hold", "offer", "joined", "note"]),
  body: z.string().max(2000).optional(),
});

const STATUS_FOR_KIND: Record<string, "shortlist" | "reject" | "interview" | "hold" | "offer" | "joined" | null> = {
  shortlist: "shortlist",
  reject: "reject",
  interview: "interview",
  hold: "hold",
  offer: "offer",
  joined: "joined",
  note: null,
};

export async function clientFeedbackAction(submissionId: number, formData: FormData): Promise<void> {
  const user = await requireClient();
  const parsed = feedbackSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) redirect(`/portal/client/submissions/${submissionId}?error=invalid`);

  // Confirm this submission belongs to a job for the client's account.
  const sub = (
    await db
      .select({
        sub: submissions,
        candidate: { fullName: candidates.fullName },
        job: { title: jobs.title, clientAccountId: jobs.clientAccountId },
      })
      .from(submissions)
      .innerJoin(candidates, eq(submissions.candidateId, candidates.id))
      .innerJoin(jobs, eq(submissions.jobId, jobs.id))
      .where(eq(submissions.id, submissionId))
  )[0];
  if (!sub) redirect("/portal/client?error=not_found");

  const u = (await db.select().from(users).where(eq(users.id, Number(user.id))))[0];
  if (user.role === "client" && (!u || u.clientAccountId !== sub.job.clientAccountId)) {
    redirect("/portal/client?error=forbidden");
  }

  await db.insert(feedbackEvents).values({
    submissionId,
    kind: parsed.data.kind,
    body: parsed.data.body || null,
    authorId: Number(user.id),
  });

  const newStatus = STATUS_FOR_KIND[parsed.data.kind];
  if (newStatus) {
    await db.update(submissions).set({ status: newStatus, updatedAt: new Date() }).where(eq(submissions.id, submissionId));
  }

  // Notify HR owner of the submission, if any.
  if (sub.sub.submittedById) {
    await db.insert(notifications).values({
      userId: sub.sub.submittedById,
      kind: "feedback",
      title: `Client feedback: ${parsed.data.kind}`,
      body: `${sub.candidate.fullName} → ${sub.job.title}`,
      url: `/candidates/${sub.sub.candidateId}`,
    });
  }

  await logAudit({
    actorId: Number(user.id),
    actorEmail: user.email,
    action: "feedback",
    targetType: "submission",
    targetId: submissionId,
    summary: `${parsed.data.kind} on ${sub.candidate.fullName}`,
  });

  revalidatePath(`/portal/client/submissions/${submissionId}`);
  revalidatePath("/portal/client");
  redirect(`/portal/client/submissions/${submissionId}`);
}
