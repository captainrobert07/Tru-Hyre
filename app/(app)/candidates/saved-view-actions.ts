"use server";

import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { savedViews } from "@/db/schema";
import { requireUser } from "@/lib/rbac";

const SCOPES = ["candidates", "jobs", "clients", "vendors", "submissions"] as const;

const createSchema = z.object({
  scope: z.enum(SCOPES),
  name: z.string().min(1).max(80),
  query: z.record(z.string(), z.string()),
});

export async function createSavedViewAction(input: unknown): Promise<{ ok: true; id: number } | { ok: false; error: string }> {
  const me = await requireUser();
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input" };
  const [row] = await db
    .insert(savedViews)
    .values({
      userId: Number(me.id),
      scope: parsed.data.scope,
      name: parsed.data.name,
      query: parsed.data.query,
      pinned: true,
    })
    .returning();
  revalidatePath(`/${parsed.data.scope}`);
  return { ok: true, id: row.id };
}

export async function deleteSavedViewAction(id: number): Promise<void> {
  const me = await requireUser();
  const v = (await db.select({ scope: savedViews.scope, userId: savedViews.userId }).from(savedViews).where(eq(savedViews.id, id)))[0];
  if (!v) return;
  if (v.userId !== Number(me.id)) return;
  await db.delete(savedViews).where(eq(savedViews.id, id));
  revalidatePath(`/${v.scope}`);
}

export async function togglePinSavedViewAction(id: number): Promise<void> {
  const me = await requireUser();
  const v = (await db.select().from(savedViews).where(and(eq(savedViews.id, id), eq(savedViews.userId, Number(me.id)))))[0];
  if (!v) return;
  await db.update(savedViews).set({ pinned: !v.pinned }).where(eq(savedViews.id, id));
  revalidatePath(`/${v.scope}`);
}
