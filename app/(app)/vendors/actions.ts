"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { vendorAccounts } from "@/db/schema";
import { logAudit } from "@/lib/audit";
import { requireStaff } from "@/lib/rbac";
import { withToast } from "@/lib/toast";

const schema = z.object({
  name: z.string().min(2).max(200),
  contactName: z.string().max(120).optional().or(z.literal("")),
  contactEmail: z.string().email().optional().or(z.literal("")),
  contactPhone: z.string().max(40).optional().or(z.literal("")),
  country: z.string().max(80).optional().or(z.literal("")),
  notes: z.string().max(2000).optional().or(z.literal("")),
});

export async function createVendorAction(formData: FormData): Promise<void> {
  const user = await requireStaff();
  const parsed = schema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) redirect("/vendors/new?error=invalid");
  const v = parsed.data;
  const [created] = await db
    .insert(vendorAccounts)
    .values({
      name: v.name,
      contactName: v.contactName || null,
      contactEmail: v.contactEmail || null,
      contactPhone: v.contactPhone || null,
      country: v.country || null,
      notes: v.notes || null,
    })
    .returning();
  await logAudit({
    actorId: Number(user.id),
    actorEmail: user.email,
    action: "create",
    targetType: "vendor",
    targetId: created.id,
    summary: `Created vendor ${v.name}`,
  });
  revalidatePath("/vendors");
  redirect(withToast(`/vendors/${created.id}`, `Vendor "${v.name}" created`));
}

export async function updateVendorAction(id: number, formData: FormData): Promise<void> {
  const user = await requireStaff();
  const parsed = schema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) redirect(`/vendors/${id}/edit?error=invalid`);
  const v = parsed.data;
  await db
    .update(vendorAccounts)
    .set({
      name: v.name,
      contactName: v.contactName || null,
      contactEmail: v.contactEmail || null,
      contactPhone: v.contactPhone || null,
      country: v.country || null,
      notes: v.notes || null,
      updatedAt: new Date(),
    })
    .where(eq(vendorAccounts.id, id));
  await logAudit({
    actorId: Number(user.id),
    actorEmail: user.email,
    action: "update",
    targetType: "vendor",
    targetId: id,
    summary: `Updated vendor ${v.name}`,
  });
  revalidatePath(`/vendors/${id}`);
  revalidatePath("/vendors");
  redirect(withToast(`/vendors/${id}`, "Vendor updated"));
}
