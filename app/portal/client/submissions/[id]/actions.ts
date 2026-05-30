"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import {
  candidates,
  submissions,
  jobs,
  users,
  comments as commentsTable,
  feedbackEvents,
  notifications,
} from "@/db/schema";
import { logAudit } from "@/lib/audit";
import { requireClient } from "@/lib/rbac";
import { withToast } from "@/lib/toast";

async function ensureAccess(submissionId: number, userId: number, userRole: string) {
  const row = (
    await db
      .select({ candidateId: submissions.candidateId, jobClientId: jobs.clientAccountId })
      .from(submissions)
      .innerJoin(jobs, eq(submissions.jobId, jobs.id))
      .where(eq(submissions.id, submissionId))
  )[0];
  if (!row) return null;
  if (userRole === "admin") return row;
  const u = (await db.select().from(users).where(eq(users.id, userId)))[0];
  if (!u || u.clientAccountId !== row.jobClientId) return null;
  return row;
}

export async function toggleStarAction(submissionId: number): Promise<void> {
  const me = await requireClient();
  const row = await ensureAccess(submissionId, Number(me.id), me.role);
  if (!row) redirect("/portal/client?error=forbidden");

  const c = (await db.select({ id: candidates.id, starred: candidates.starredByClient, fullName: candidates.fullName }).from(candidates).where(eq(candidates.id, row.candidateId)))[0];
  if (!c) redirect("/portal/client");
  await db.update(candidates).set({ starredByClient: !c.starred, updatedAt: new Date() }).where(eq(candidates.id, c.id));

  await logAudit({
    actorId: Number(me.id),
    actorEmail: me.email,
    action: "update",
    targetType: "candidate",
    targetId: c.id,
    summary: `${c.starred ? "Unstarred" : "Starred"} ${c.fullName}`,
  });
  revalidatePath(`/portal/client/submissions/${submissionId}`);
  revalidatePath("/portal/client");
}

/**
 * One-click feedback from the client portal list/detail. Validates that
 * the current user owns the submission's client account, writes a
 * feedback_event, mirrors the submission status, and notifies HR.
 */
export async function quickClientFeedbackAction(
  submissionId: number,
  kind: "shortlist" | "reject" | "interview" | "hold",
): Promise<void> {
  const me = await requireClient();
  const access = await ensureAccess(submissionId, Number(me.id), me.role);
  if (!access) return;

  const cand = (
    await db
      .select({ fullName: candidates.fullName })
      .from(candidates)
      .where(eq(candidates.id, access.candidateId))
  )[0];
  if (!cand) return;

  await db.insert(feedbackEvents).values({
    submissionId,
    kind,
    body: null,
    authorId: Number(me.id),
  });

  await db.update(submissions).set({ status: kind, updatedAt: new Date() }).where(eq(submissions.id, submissionId));

  // Notify the recruiter who submitted this (if known)
  const sub = (await db.select().from(submissions).where(eq(submissions.id, submissionId)))[0];
  if (sub?.submittedById) {
    const job = (await db.select({ title: jobs.title }).from(jobs).where(eq(jobs.id, sub.jobId)))[0];
    await db.insert(notifications).values({
      userId: sub.submittedById,
      kind: "feedback",
      title: `Client decision: ${kind}`,
      body: `${cand.fullName} → ${job?.title || "job"}`,
      url: `/candidates/${access.candidateId}`,
    });
  }

  await logAudit({
    actorId: Number(me.id),
    actorEmail: me.email,
    action: "feedback",
    targetType: "submission",
    targetId: submissionId,
    summary: `Quick ${kind} on ${cand.fullName}`,
  });

  revalidatePath("/portal/client");
  revalidatePath(`/portal/client/submissions/${submissionId}`);
}

/**
 * Bulk decision across many submissions. Used by the multi-select toolbar
 * on the client portal home.
 */
export async function bulkClientFeedbackAction(
  ids: number[],
  kind: "shortlist" | "reject" | "interview" | "hold",
): Promise<{ ok: true; affected: number } | { ok: false; error: string }> {
  const me = await requireClient();
  if (!Array.isArray(ids) || ids.length === 0 || ids.length > 200) {
    return { ok: false, error: "Pick 1–200 candidates." };
  }

  let affected = 0;
  for (const id of ids) {
    const access = await ensureAccess(id, Number(me.id), me.role);
    if (!access) continue;
    await quickClientFeedbackAction(id, kind);
    affected++;
  }
  return { ok: true, affected };
}

const internalSchema = (formData: FormData) => {
  const body = (formData.get("body") || "").toString().trim();
  return body && body.length <= 4000 ? body : null;
};

/**
 * Internal client comment: tagged with [internal] in the body so the recruiter
 * UI can filter it out. Reuses the existing comments table.
 */
export async function addClientInternalCommentAction(submissionId: number, formData: FormData): Promise<void> {
  const me = await requireClient();
  const body = internalSchema(formData);
  if (!body) redirect(`/portal/client/submissions/${submissionId}`);
  const row = await ensureAccess(submissionId, Number(me.id), me.role);
  if (!row) redirect("/portal/client?error=forbidden");

  await db.insert(commentsTable).values({
    targetType: "submission",
    targetId: submissionId,
    authorId: Number(me.id),
    authorEmail: me.email,
    body: `[client-internal] ${body}`,
    mentions: [],
  });
  await logAudit({
    actorId: Number(me.id),
    actorEmail: me.email,
    action: "create",
    targetType: "submission_comment",
    targetId: submissionId,
    summary: `Internal client note on submission #${submissionId}`,
  });
  revalidatePath(`/portal/client/submissions/${submissionId}`);
  redirect(withToast(`/portal/client/submissions/${submissionId}`, "Internal note saved"));
}
