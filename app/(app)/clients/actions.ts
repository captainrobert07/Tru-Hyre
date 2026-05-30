"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { clientAccounts, clientContacts } from "@/db/schema";
import { logAudit } from "@/lib/audit";
import { requireStaff } from "@/lib/rbac";
import { withToast } from "@/lib/toast";

const clientSchema = z.object({
  name: z.string().min(2).max(200),
  industry: z.string().max(120).optional().or(z.literal("")),
  website: z.string().max(254).optional().or(z.literal("")),
  primaryContactName: z.string().max(120).optional().or(z.literal("")),
  primaryContactEmail: z.string().email().optional().or(z.literal("")),
  primaryContactPhone: z.string().max(40).optional().or(z.literal("")),
  notes: z.string().max(2000).optional().or(z.literal("")),
});

export async function createClientAction(formData: FormData): Promise<void> {
  const user = await requireStaff();
  const parsed = clientSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) redirect("/clients/new?error=invalid");
  const v = parsed.data;
  const [created] = await db
    .insert(clientAccounts)
    .values({
      name: v.name,
      industry: v.industry || null,
      website: v.website || null,
      primaryContactName: v.primaryContactName || null,
      primaryContactEmail: v.primaryContactEmail || null,
      primaryContactPhone: v.primaryContactPhone || null,
      notes: v.notes || null,
    })
    .returning();
  await logAudit({
    actorId: Number(user.id),
    actorEmail: user.email,
    action: "create",
    targetType: "client",
    targetId: created.id,
    summary: `Created client ${v.name}`,
  });
  revalidatePath("/clients");
  redirect(withToast(`/clients/${created.id}`, `Client "${v.name}" created`));
}

export async function updateClientAction(id: number, formData: FormData): Promise<void> {
  const user = await requireStaff();
  const parsed = clientSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) redirect(`/clients/${id}/edit?error=invalid`);
  const v = parsed.data;
  await db
    .update(clientAccounts)
    .set({
      name: v.name,
      industry: v.industry || null,
      website: v.website || null,
      primaryContactName: v.primaryContactName || null,
      primaryContactEmail: v.primaryContactEmail || null,
      primaryContactPhone: v.primaryContactPhone || null,
      notes: v.notes || null,
      updatedAt: new Date(),
    })
    .where(eq(clientAccounts.id, id));
  await logAudit({
    actorId: Number(user.id),
    actorEmail: user.email,
    action: "update",
    targetType: "client",
    targetId: id,
    summary: `Updated client ${v.name}`,
  });
  revalidatePath(`/clients/${id}`);
  revalidatePath("/clients");
  redirect(withToast(`/clients/${id}`, "Client updated"));
}

const contactSchema = z.object({
  name: z.string().min(1).max(120),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().max(40).optional().or(z.literal("")),
  title: z.string().max(120).optional().or(z.literal("")),
  isPrimary: z.coerce.boolean().optional(),
});

export async function addContactAction(clientId: number, formData: FormData): Promise<void> {
  const user = await requireStaff();
  const parsed = contactSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) redirect(`/clients/${clientId}?error=contact_invalid`);
  const v = parsed.data;
  await db.insert(clientContacts).values({
    clientAccountId: clientId,
    name: v.name,
    email: v.email || null,
    phone: v.phone || null,
    title: v.title || null,
    isPrimary: !!v.isPrimary,
  });
  await logAudit({
    actorId: Number(user.id),
    actorEmail: user.email,
    action: "create",
    targetType: "client_contact",
    targetId: clientId,
    summary: `Added contact ${v.name}`,
  });
  revalidatePath(`/clients/${clientId}`);
  redirect(withToast(`/clients/${clientId}`, `Contact "${v.name}" added`));
}
