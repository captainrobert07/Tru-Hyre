"use server";

import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { vendorAccounts, users, notifications } from "@/db/schema";
import { isFeatureEnabled } from "@/lib/features";
import { logAudit } from "@/lib/audit";

const schema = z.object({
  name: z.string().min(2).max(200),
  contactName: z.string().max(120).optional().or(z.literal("")),
  contactEmail: z.string().email().max(254),
  contactPhone: z.string().max(40).optional().or(z.literal("")),
  country: z.string().max(80).optional().or(z.literal("")),
  notes: z.string().max(1000).optional().or(z.literal("")),
  website: z.string().max(0).optional().or(z.literal("")), // honeypot
});

export type VendorSignupResult = { ok: true } | { ok: false; error: string };

export async function vendorSignupAction(_prev: VendorSignupResult | null, formData: FormData): Promise<VendorSignupResult> {
  if (!(await isFeatureEnabled("vendor_onboarding"))) return { ok: false, error: "Vendor signups are closed." };
  const parsed = schema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { ok: false, error: "Please fill in your agency name and a valid contact email." };
  const v = parsed.data;
  if (v.website) return { ok: true }; // honeypot tripped

  // Avoid duplicate names colliding with the unique constraint.
  const existing = (await db.select({ id: vendorAccounts.id }).from(vendorAccounts).where(eq(vendorAccounts.name, v.name)))[0];
  if (existing) return { ok: false, error: "A vendor with that name already exists — contact us directly." };

  await db.insert(vendorAccounts).values({
    name: v.name,
    contactName: v.contactName || null,
    contactEmail: v.contactEmail,
    contactPhone: v.contactPhone || null,
    country: v.country || null,
    notes: v.notes ? `Self-signup: ${v.notes}` : "Self-signup (pending approval)",
    approvalStatus: "pending",
  });

  // Notify HR/admin staff to review.
  const staff = await db.select({ id: users.id }).from(users).where(eq(users.role, "hr"));
  if (staff.length) {
    await db.insert(notifications).values(staff.map((s) => ({
      userId: s.id, kind: "system" as const,
      title: `New vendor application: ${v.name}`, body: v.contactEmail, url: "/vendors",
    })));
  }
  await logAudit({ action: "create", targetType: "vendor", summary: `Vendor self-signup: ${v.name} (pending)` });
  return { ok: true };
}
