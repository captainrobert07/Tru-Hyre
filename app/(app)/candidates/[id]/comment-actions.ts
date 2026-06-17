"use server";

import { eq, and, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { comments, users, notifications, candidates } from "@/db/schema";
import { logAudit } from "@/lib/audit";
import { requireStaff, authorizeCandidate } from "@/lib/rbac";

const schema = z.object({
  body: z.string().min(1).max(4000),
});

function extractMentions(body: string): string[] {
  const out = new Set<string>();
  const re = /(?<![\w@])@([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g;
  for (const m of body.matchAll(re)) out.add(m[1].toLowerCase());
  return [...out];
}

export async function addCandidateCommentAction(candidateId: number, formData: FormData): Promise<void> {
  const parsed = schema.safeParse({ body: (formData.get("body") || "").toString().trim() });
  if (!parsed.success) return;
  const body = parsed.data.body;

  const cand = (await db.select({ fullName: candidates.fullName, uploadedById: candidates.uploadedById }).from(candidates).where(eq(candidates.id, candidateId)))[0];
  if (!cand) return;
  // Full staff comment on anyone; hr_lite only on candidates they uploaded.
  const me = await authorizeCandidate(cand.uploadedById);
  if (!me) return;

  const mentionedEmails = extractMentions(body);
  let mentionedIds: number[] = [];
  if (mentionedEmails.length > 0) {
    // Only mention staff. Mentioning a client/vendor would leak HR-internal
    // candidate notes into their notification feed.
    const found = await db
      .select({ id: users.id, email: users.email, role: users.role })
      .from(users)
      .where(inArray(users.email, mentionedEmails));
    mentionedIds = found.filter((u) => u.role === "admin" || u.role === "hr").map((u) => u.id);
  }

  await db.insert(comments).values({
    targetType: "candidate",
    targetId: candidateId,
    authorId: Number(me.id),
    authorEmail: me.email,
    body,
    mentions: mentionedIds,
  });

  // Notify mentioned users — title only, no body (which may contain
  // sensitive notes). They click through to read. One batched multi-row insert
  // (was N sequential inserts; the rows differ only by userId).
  const notifyRows = mentionedIds
    .filter((userId) => userId !== Number(me.id))
    .map((userId) => ({
      userId,
      kind: "system" as const,
      title: `${me.fullName || me.email} mentioned you on ${cand.fullName}`,
      body: null,
      url: `/candidates/${candidateId}`,
    }));
  if (notifyRows.length > 0) {
    await db.insert(notifications).values(notifyRows);
  }

  await logAudit({
    actorId: Number(me.id),
    actorEmail: me.email,
    action: "create",
    targetType: "candidate_comment",
    targetId: candidateId,
    summary: `Commented on ${cand.fullName}`,
    meta: { mentions: mentionedIds.length },
  });

  revalidatePath(`/candidates/${candidateId}`);
}

export async function deleteCandidateCommentAction(candidateId: number, commentId: number): Promise<void> {
  const me = await requireStaff();
  const c = (await db.select().from(comments).where(and(eq(comments.id, commentId), eq(comments.targetType, "candidate"), eq(comments.targetId, candidateId))))[0];
  if (!c) return;
  if (c.authorId !== Number(me.id) && me.role !== "admin") return;

  await db.delete(comments).where(eq(comments.id, commentId));
  await logAudit({
    actorId: Number(me.id),
    actorEmail: me.email,
    action: "delete",
    targetType: "candidate_comment",
    targetId: commentId,
    summary: `Deleted a comment`,
  });
  revalidatePath(`/candidates/${candidateId}`);
}
