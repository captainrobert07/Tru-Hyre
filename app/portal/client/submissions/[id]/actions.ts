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

  const c = (
    await db
      .select({
        id: candidates.id,
        starred: candidates.starredByClient,
        fullName: candidates.fullName,
      })
      .from(candidates)
      .where(eq(candidates.id, row.candidateId))
  )[0];
  if (!c) redirect("/portal/client");
  await db
    .update(candidates)
    .set({ starredByClient: !c.starred, updatedAt: new Date() })
    .where(eq(candidates.id, c.id));

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

export async function addClientInternalCommentAction(
  submissionId: number,
  formData: FormData,
): Promise<void> {
  const me = await requireClient();
  const body = (formData.get("body") || "").toString().trim();
  if (!body || body.length > 4000) redirect(`/portal/client/submissions/${submissionId}`);
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
