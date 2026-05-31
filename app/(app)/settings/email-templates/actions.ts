"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { emailTemplates } from "@/db/schema";
import { logAudit } from "@/lib/audit";
import { requireStaff } from "@/lib/rbac";

const updateSchema = z.object({
  slug: z.string().min(1).max(64),
  subject: z.string().min(1).max(240),
  bodyText: z.string().min(1).max(20_000),
  bodyHtml: z.string().min(1).max(50_000),
  isActive: z.coerce.boolean(),
});

export type UpdateResult = { ok: true } | { ok: false; error: string };

export async function updateTemplateAction(_prev: UpdateResult | null, formData: FormData): Promise<UpdateResult> {
  const user = await requireStaff();
  const parsed = updateSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message || "Invalid input" };
  }
  const { slug, subject, bodyText, bodyHtml, isActive } = parsed.data;

  const existing = (await db.select().from(emailTemplates).where(eq(emailTemplates.slug, slug)))[0];
  if (!existing) return { ok: false, error: "Template not found" };

  await db
    .update(emailTemplates)
    .set({
      subject,
      bodyText,
      bodyHtml,
      isActive,
      updatedById: Number(user.id),
      updatedAt: new Date(),
    })
    .where(eq(emailTemplates.slug, slug));

  await logAudit({
    actorId: Number(user.id),
    actorEmail: user.email,
    action: "template_edit",
    targetType: "email_template",
    targetId: slug,
    summary: `Updated email template "${slug}"`,
    meta: { isActive },
  });

  revalidatePath("/settings/email-templates");
  revalidatePath(`/settings/email-templates/${slug}/edit`);
  return { ok: true };
}

export async function toggleActiveAction(slug: string, active: boolean): Promise<UpdateResult> {
  const user = await requireStaff();
  if (!slug) return { ok: false, error: "Missing slug" };

  const existing = (await db.select().from(emailTemplates).where(eq(emailTemplates.slug, slug)))[0];
  if (!existing) return { ok: false, error: "Template not found" };

  await db
    .update(emailTemplates)
    .set({ isActive: active, updatedById: Number(user.id), updatedAt: new Date() })
    .where(eq(emailTemplates.slug, slug));

  await logAudit({
    actorId: Number(user.id),
    actorEmail: user.email,
    action: "template_edit",
    targetType: "email_template",
    targetId: slug,
    summary: `Toggled "${slug}" → ${active ? "active" : "inactive"}`,
  });

  revalidatePath("/settings/email-templates");
  return { ok: true };
}
