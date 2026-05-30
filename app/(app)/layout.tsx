import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { auth } from "@/auth";
import { AppShell } from "@/components/app-shell";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const u = session.user as { fullName?: string; email?: string; role?: string };
  if (!u.role) redirect("/login");
  if (u.role === "client") redirect("/portal/client");
  if (u.role === "vendor") redirect("/portal/vendor");

  return (
    <AppShell user={{ fullName: u.fullName || u.email || "", email: u.email || "", role: u.role as "admin" | "hr" }}>
      {children}
    </AppShell>
  );
}
