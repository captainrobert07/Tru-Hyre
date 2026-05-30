import { redirect } from "next/navigation";
import { auth } from "@/auth";

export type SessionUser = {
  id: string;
  email: string;
  fullName: string;
  role: "admin" | "hr" | "client" | "vendor";
};

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
