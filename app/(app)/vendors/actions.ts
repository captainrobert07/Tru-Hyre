"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { vendorAccounts } from "@/db/schema";
import { logAudit } from "@/lib/audit";
import { requireStaff } from "@/lib/rbac";
import { isFeatureEnabled } from "@/lib/features";
import { withToast } from "@/lib/toast";

export async function approveVendorAction(id: number, approve: boolean): Promise<{ ok: boolean }> {
  const user = await requireStaff();
  await db.update(vendorAccounts).set({ approvalStatus: approve ? "approved" : "rejected", updatedAt: new Date() }).where(eq(vendorAccounts.id, id));
  await logAudit({ actorId: Number(user.id), actorEmail: user.email, action: "update", targetType: "vendor", targetId: id, summary: `${approve ? "Approved" : "Rejected"} vendor application` });
  revalidatePath(`/vendors/${id}`);
  revalidatePath("/vendors");
  return { ok: true };
}

const schema = z.object({
  name: z.string().min(2).max(200),
  contactName: z.string().max(120).optional().or(z.literal("")),
  contactEmail: z.string().email().optional().or(z.literal("")),
  contactPhone: z.string().max(40).optional().or(z.literal("")),
  country: z.string().max(80).optional().or(z.literal("")),
  feePercent: z.string().max(12).optional().or(z.literal("")),
  paymentTerms: z.string().max(200).optional().or(z.literal("")),
  notes: z.string().max(2000).optional().or(z.literal("")),
});

// Coerce the fee % string to a numeric value (0–100) or null.
function parseFee(raw?: string): string | null {
  if (!raw) return null;
  const n = Number(raw.replace(/[%\s]/g, ""));
  if (!Number.isFinite(n) || n < 0 || n > 100) return null;
  return String(n);
}

export async function createVendorAction(formData: FormData): Promise<void> {
  const user = await requireStaff();
  const parsed = schema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) redirect("/vendors/new?error=invalid");
  const v = parsed.data;
  // Commission fields only persist when the feature is on; otherwise ignore
  // them even if posted, so a disabled feature can't write commission data.
  const commissionOn = await isFeatureEnabled("vendor_commission");
  const [created] = await db
    .insert(vendorAccounts)
    .values({
      name: v.name,
      contactName: v.contactName || null,
      contactEmail: v.contactEmail || null,
      contactPhone: v.contactPhone || null,
      country: v.country || null,
      feePercent: commissionOn ? parseFee(v.feePercent) : null,
      paymentTerms: commissionOn ? (v.paymentTerms || null) : null,
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
  const commissionOn = await isFeatureEnabled("vendor_commission");
  // When commission is off, leave the existing fee/terms untouched rather than
  // wiping them (preserves data set while the feature was on).
  const commissionPatch = commissionOn
    ? { feePercent: parseFee(v.feePercent), paymentTerms: v.paymentTerms || null }
    : {};
  await db
    .update(vendorAccounts)
    .set({
      name: v.name,
      contactName: v.contactName || null,
      contactEmail: v.contactEmail || null,
      contactPhone: v.contactPhone || null,
      country: v.country || null,
      ...commissionPatch,
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
