import { redirect } from "next/navigation";
import { auth } from "@/auth";

export type SessionUser = {
  id: string;
  email: string;
  fullName: string;
  role: "admin" | "hr" | "hr_lite" | "client" | "vendor" | "candidate";
  permissions?: string[];
};

/** True if the user holds a granular permission. Admin always passes. */
export function hasPermission(user: SessionUser, key: string): boolean {
  if (user.role === "admin") return true;
  return Array.isArray(user.permissions) && user.permissions.includes(key);
}

export async function requireUser(): Promise<SessionUser> {
  const session = await auth();
  const u = session?.user as Partial<SessionUser> | undefined;
  if (!u?.id || !u.role) redirect("/login");
  return u as SessionUser;
}

export async function requireStaff(): Promise<SessionUser> {
  const u = await requireUser();
  if (u.role !== "admin" && u.role !== "hr") redirect("/");
  return u;
}

/**
 * Full staff (admin/hr) OR the limited hr_lite role. Used on the candidate
 * surfaces hr_lite is allowed into (list, detail, upload). Callers MUST further
 * restrict hr_lite to their own uploaded candidates via isLite()/ownership.
 */
export async function requireStaffOrLite(): Promise<SessionUser> {
  const u = await requireUser();
  if (u.role !== "admin" && u.role !== "hr" && u.role !== "hr_lite") redirect("/");
  return u;
}

/** True for the limited uploader role. */
export function isLite(u: SessionUser): boolean {
  return u.role === "hr_lite";
}

/** Gate for the candidate self-service portal. Admin may also view. */
export async function requireCandidate(): Promise<SessionUser> {
  const u = await requireUser();
  if (u.role !== "candidate" && u.role !== "admin") redirect("/");
  return u;
}

/**
 * Authorize a mutation on a specific candidate for staff-or-lite. Full staff
 * (admin/hr) may act on any candidate; hr_lite only on candidates they
 * uploaded. Returns the user, or null when not authorized (caller should
 * no-op/return an error — never throw into a server action).
 */
export async function authorizeCandidate(
  uploadedById: number | null,
): Promise<SessionUser | null> {
  const u = await requireStaffOrLite();
  if (u.role === "admin" || u.role === "hr") return u;
  // hr_lite
  if (uploadedById != null && uploadedById === Number(u.id)) return u;
  return null;
}

export async function requireAdmin(): Promise<SessionUser> {
  const u = await requireUser();
  if (u.role !== "admin") redirect("/");
  return u;
}

export async function requireClient(): Promise<SessionUser> {
  const u = await requireUser();
  if (u.role !== "client" && u.role !== "admin") redirect("/");
  return u;
}

export async function requireVendor(): Promise<SessionUser> {
  const u = await requireUser();
  if (u.role !== "vendor" && u.role !== "admin") redirect("/");
  return u;
}
