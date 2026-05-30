"use server";

import { eq, and, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { comments, users, notifications, candidates } from "@/db/schema";
import { logAudit } from "@/lib/audit";
import { requireStaff } from "@/lib/rbac";

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
  const me = await requireStaff();
  const parsed = schema.safeParse({ body: (formData.get("body") || "").toString().trim() });
  if (!parsed.success) return;
  const body = parsed.data.body;

  const cand = (await db.select({ fullName: candidates.fullName }).from(candidates).where(eq(candidates.id, candidateId)))[0];
  if (!cand) return;

  const mentionedEmails = extractMentions(body);
  let mentionedIds: number[] = [];
  if (mentionedEmails.length > 0) {
    const found = await db
      .select({ id: users.id, email: users.email })
      .from(users)
      .where(inArray(users.email, mentionedEmails));
    mentionedIds = found.map((u) => u.id);
  }

  await db.insert(comments).values({
    targetType: "candidate",
    targetId: candidateId,
    authorId: Number(me.id),
    authorEmail: me.email,
    body,
    mentions: mentionedIds,
  });

  // Notify mentioned users
  for (const userId of mentionedIds) {
    if (userId === Number(me.id)) continue;
    await db.insert(notifications).values({
      userId,
      kind: "system",
      title: `${me.fullName || me.email} mentioned you`,
      body: body.slice(0, 200),
      url: `/candidates/${candidateId}`,
    });
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
