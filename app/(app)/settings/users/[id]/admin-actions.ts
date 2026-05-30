"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { db } from "@/db";
import { users } from "@/db/schema";
import { logAudit } from "@/lib/audit";
import { requireAdmin } from "@/lib/rbac";
import { withToast } from "@/lib/toast";

const IMPERSONATE_COOKIE = "th_impersonate";

export async function deactivateUserAction(id: number): Promise<void> {
  const me = await requireAdmin();
  if (Number(me.id) === id) redirect(withToast("/settings/users", "You can't deactivate yourself", "error"));
  const u = (await db.select().from(users).where(eq(users.id, id)))[0];
  if (!u) redirect("/settings/users");
  await db.update(users).set({ isActive: !u.isActive, updatedAt: new Date() }).where(eq(users.id, id));
  await logAudit({
    actorId: Number(me.id),
    actorEmail: me.email,
    action: "update",
    targetType: "user",
    targetId: id,
    summary: `${u.isActive ? "Deactivated" : "Reactivated"} user ${u.email}`,
  });
  revalidatePath("/settings/users");
  redirect(withToast("/settings/users", `${u.isActive ? "Deactivated" : "Reactivated"} ${u.email}`));
}

export async function forcePasswordResetAction(id: number): Promise<void> {
  const me = await requireAdmin();
  const u = (await db.select().from(users).where(eq(users.id, id)))[0];
  if (!u) redirect("/settings/users");
  // Generate a memorable temp password and force a reset on next login.
  // Real-world: email it. For now we audit it for the admin to copy.
  const tempPassword = `TruHyre-${Math.random().toString(36).slice(2, 10)}`;
  const hash = await bcrypt.hash(tempPassword, 10);
  await db.update(users).set({ passwordHash: hash, updatedAt: new Date() }).where(eq(users.id, id));
  await logAudit({
    actorId: Number(me.id),
    actorEmail: me.email,
    action: "role_change",
    targetType: "user",
    targetId: id,
    summary: `Force-reset password for ${u.email}`,
    meta: { tempPassword },
  });
  revalidatePath("/settings/users");
  redirect(withToast(`/settings/users/${id}/edit`, `Temp password set: ${tempPassword} (also in audit log)`));
}

/**
 * Begin impersonation: write the actor's user-id into a signed-ish cookie
 * along with the target user's id. The /api/auth flow honors this cookie
 * by minting a session for the target user without requiring their
 * password.
 *
 * NOTE: this is a deliberate elevation. Only an admin can call it; every
 * impersonation is audited; the cookie expires in 1 hour.
 */
export async function startImpersonation(id: number): Promise<void> {
  const me = await requireAdmin();
  const target = (await db.select().from(users).where(eq(users.id, id)))[0];
  if (!target) redirect("/settings/users");
  if (Number(me.id) === id) redirect(withToast("/settings/users", "You can't impersonate yourself", "error"));

  const c = await cookies();
  c.set(IMPERSONATE_COOKIE, JSON.stringify({ adminId: Number(me.id), targetId: id, at: Date.now() }), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 60 * 60,
    path: "/",
  });

  await logAudit({
    actorId: Number(me.id),
    actorEmail: me.email,
    action: "role_change",
    targetType: "user",
    targetId: id,
    summary: `Started impersonation as ${target.email}`,
  });
  redirect(withToast("/dashboard", `Impersonating ${target.email} (1h)`, "info"));
}

export async function stopImpersonation(): Promise<void> {
  const me = await requireAdmin();
  const c = await cookies();
  c.delete(IMPERSONATE_COOKIE);
  await logAudit({
    actorId: Number(me.id),
    actorEmail: me.email,
    action: "role_change",
    targetType: "user",
    summary: `Stopped impersonation`,
  });
  redirect(withToast("/dashboard", "Stopped impersonating"));
}
