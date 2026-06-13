"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { randomBytes } from "crypto";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { headers } from "next/headers";
import { db } from "@/db";
import { users, invitations, clientAccounts, vendorAccounts } from "@/db/schema";
import { logAudit } from "@/lib/audit";
import { sendEmail, inviteEmail } from "@/lib/email";
import { requireAdmin } from "@/lib/rbac";
import { withToast } from "@/lib/toast";

const userSchema = z.object({
  email: z.string().email().toLowerCase().trim(),
  fullName: z.string().min(2).max(120),
  role: z.enum(["admin", "hr", "hr_lite", "client", "vendor"]),
  clientAccountId: z
    .union([z.coerce.number().int().positive(), z.literal(""), z.literal("none")])
    .transform((v) => (typeof v === "number" ? v : null)),
  vendorAccountId: z
    .union([z.coerce.number().int().positive(), z.literal(""), z.literal("none")])
    .transform((v) => (typeof v === "number" ? v : null)),
  password: z.string().min(8).max(120).optional().or(z.literal("")),
  isActive: z.coerce.boolean().optional(),
});

export async function createUserAction(formData: FormData): Promise<void> {
  const me = await requireAdmin();
  const parsed = userSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) redirect("/settings/users/new?error=invalid");
  const v = parsed.data;
  if (!v.password) redirect("/settings/users/new?error=password_required");
  const passwordHash = await bcrypt.hash(v.password!, 10);
  await db.insert(users).values({
    email: v.email,
    fullName: v.fullName,
    role: v.role,
    clientAccountId: v.clientAccountId,
    vendorAccountId: v.vendorAccountId,
    isActive: v.isActive ?? true,
    passwordHash,
  });
  await logAudit({
    actorId: Number(me.id),
    actorEmail: me.email,
    action: "create",
    targetType: "user",
    summary: `Created user ${v.email} (${v.role})`,
  });
  revalidatePath("/settings/users");
  redirect(withToast("/settings/users", `User ${v.email} created`));
}

export async function updateUserAction(id: number, formData: FormData): Promise<void> {
  const me = await requireAdmin();
  const parsed = userSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) redirect(`/settings/users/${id}/edit?error=invalid`);
  const v = parsed.data;
  const update: Record<string, unknown> = {
    email: v.email,
    fullName: v.fullName,
    role: v.role,
    clientAccountId: v.clientAccountId,
    vendorAccountId: v.vendorAccountId,
    isActive: v.isActive ?? true,
    updatedAt: new Date(),
  };
  if (v.password) update.passwordHash = await bcrypt.hash(v.password, 10);
  await db.update(users).set(update).where(eq(users.id, id));
  await logAudit({
    actorId: Number(me.id),
    actorEmail: me.email,
    action: v.password ? "role_change" : "update",
    targetType: "user",
    targetId: id,
    summary: `Updated user ${v.email}`,
  });
  revalidatePath("/settings/users");
  redirect(withToast("/settings/users", `User ${v.email} updated`));
}

const inviteSchema = z.object({
  email: z.string().email().toLowerCase().trim(),
  role: z.enum(["admin", "hr", "hr_lite", "client", "vendor"]),
  clientAccountId: z
    .union([z.coerce.number().int().positive(), z.literal(""), z.literal("none")])
    .transform((v) => (typeof v === "number" ? v : null)),
  vendorAccountId: z
    .union([z.coerce.number().int().positive(), z.literal(""), z.literal("none")])
    .transform((v) => (typeof v === "number" ? v : null)),
});

export async function createInvitationAction(formData: FormData): Promise<void> {
  const me = await requireAdmin();
  const parsed = inviteSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) redirect("/settings/invitations/new?error=invalid");
  const v = parsed.data;
  const token = randomBytes(24).toString("hex");
  await db.insert(invitations).values({
    email: v.email,
    role: v.role,
    clientAccountId: v.clientAccountId,
    vendorAccountId: v.vendorAccountId,
    invitedById: Number(me.id),
    token,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    status: "pending",
  });

  const h = await headers();
  const proto = h.get("x-forwarded-proto") || "https";
  const host = h.get("x-forwarded-host") || h.get("host") || "tru-hyre-rho.vercel.app";
  const inviteUrl = `${proto}://${host}/invite/${token}`;
  const appName = process.env.NEXT_PUBLIC_APP_NAME || "Tru Hyre";
  const tmpl = inviteEmail({ appName, inviteeEmail: v.email, role: v.role, inviteUrl });
  const send = await sendEmail({ to: v.email, ...tmpl });

  await logAudit({
    actorId: Number(me.id),
    actorEmail: me.email,
    action: "invite",
    targetType: "invitation",
    summary: `Invited ${v.email} as ${v.role}`,
    meta: { emailDelivered: send.delivered, emailReason: send.reason, inviteUrl },
  });
  revalidatePath("/settings/invitations");
  redirect(withToast("/settings/invitations", send.delivered ? `Invitation emailed to ${v.email}` : `Invitation created for ${v.email} (email not sent: ${send.reason})`, send.delivered ? "success" : "info"));
}

export async function revokeInvitationAction(id: number): Promise<void> {
  const me = await requireAdmin();
  await db.update(invitations).set({ status: "revoked" }).where(eq(invitations.id, id));
  await logAudit({
    actorId: Number(me.id),
    actorEmail: me.email,
    action: "delete",
    targetType: "invitation",
    targetId: id,
    summary: "Revoked invitation",
  });
  revalidatePath("/settings/invitations");
}

const bulkInviteSchema = z.object({
  emails: z.string().min(1).max(8000),
  role: z.enum(["admin", "hr", "hr_lite", "client", "vendor"]),
  clientAccountId: z
    .union([z.coerce.number().int().positive(), z.literal(""), z.literal("none")])
    .transform((v) => (typeof v === "number" ? v : null)),
  vendorAccountId: z
    .union([z.coerce.number().int().positive(), z.literal(""), z.literal("none")])
    .transform((v) => (typeof v === "number" ? v : null)),
});

export async function bulkInviteAction(formData: FormData): Promise<void> {
  const me = await requireAdmin();
  const parsed = bulkInviteSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) redirect("/settings/invitations/bulk?error=invalid");
  const v = parsed.data;

  const emailList = v.emails
    .split(/[\s,;]+/)
    .map((e) => e.trim().toLowerCase())
    .filter((e) => /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(e));
  const unique = [...new Set(emailList)];

  let created = 0;
  let delivered = 0;
  const h = await headers();
  const proto = h.get("x-forwarded-proto") || "https";
  const host = h.get("x-forwarded-host") || h.get("host") || "tru-hyre-rho.vercel.app";
  const appName = process.env.NEXT_PUBLIC_APP_NAME || "Tru Hyre";

  for (const email of unique) {
    const token = randomBytes(24).toString("hex");
    await db.insert(invitations).values({
      email,
      role: v.role,
      clientAccountId: v.clientAccountId,
      vendorAccountId: v.vendorAccountId,
      invitedById: Number(me.id),
      token,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      status: "pending",
    });
    created++;
    const inviteUrl = `${proto}://${host}/invite/${token}`;
    const tmpl = inviteEmail({ appName, inviteeEmail: email, role: v.role, inviteUrl });
    const send = await sendEmail({ to: email, ...tmpl });
    if (send.delivered) delivered++;
  }

  await logAudit({
    actorId: Number(me.id),
    actorEmail: me.email,
    action: "invite",
    targetType: "invitation",
    summary: `Bulk-invited ${created} users as ${v.role}`,
    meta: { delivered, attempted: unique.length },
  });
  revalidatePath("/settings/invitations");
  redirect(withToast("/settings/invitations", `Sent ${created} invitations${delivered > 0 ? ` · ${delivered} emails delivered` : ""}`));
}

const profileSchema = z.object({
  name: z.string().min(2).max(200),
  tagline: z.string().max(200).optional().or(z.literal("")),
  contactEmail: z.string().email().optional().or(z.literal("")),
  parsingEnabled: z.coerce.boolean().optional(),
  ocrEnabled: z.coerce.boolean().optional(),
  aiParsingEnabled: z.coerce.boolean().optional(),
});

export async function updateCompanyProfileAction(id: number, formData: FormData): Promise<void> {
  const me = await requireAdmin();
  const parsed = profileSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) redirect("/settings/company?error=invalid");
  const v = parsed.data;
  const { companyProfile } = await import("@/db/schema");
  await db
    .update(companyProfile)
    .set({
      name: v.name,
      tagline: v.tagline || null,
      contactEmail: v.contactEmail || null,
      parsingEnabled: !!v.parsingEnabled,
      ocrEnabled: !!v.ocrEnabled,
      aiParsingEnabled: !!v.aiParsingEnabled,
      updatedAt: new Date(),
    })
    .where(eq(companyProfile.id, id));
  await logAudit({
    actorId: Number(me.id),
    actorEmail: me.email,
    action: "update",
    targetType: "company_profile",
    targetId: id,
    summary: "Updated company profile",
  });
  revalidatePath("/settings/company");
  redirect(withToast("/settings/company", "Company profile saved"));
}

export type AccountOption = { id: number; name: string };
export async function listAccountOptions(): Promise<{ clients: AccountOption[]; vendors: AccountOption[] }> {
  await requireAdmin();
  const [clients, vendors] = await Promise.all([
    db.select({ id: clientAccounts.id, name: clientAccounts.name }).from(clientAccounts).orderBy(clientAccounts.name),
    db.select({ id: vendorAccounts.id, name: vendorAccounts.name }).from(vendorAccounts).orderBy(vendorAccounts.name),
  ]);
  return { clients, vendors };
}
