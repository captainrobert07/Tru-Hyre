import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { and, eq, isNull, count } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { notifications } from "@/db/schema";
import { AppShell } from "@/components/app-shell";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const u = session.user as { id?: string; fullName?: string; email?: string; role?: string };
  if (!u.role) redirect("/login");
  if (u.role === "client") redirect("/portal/client");
  if (u.role === "vendor") redirect("/portal/vendor");

  let unreadCount = 0;
  if (u.id) {
    try {
      const r = await db
        .select({ n: count() })
        .from(notifications)
        .where(and(eq(notifications.userId, Number(u.id)), isNull(notifications.readAt)));
      unreadCount = r[0]?.n ?? 0;
    } catch {
      unreadCount = 0;
    }
  }

  return (
    <AppShell
      user={{ fullName: u.fullName || u.email || "", email: u.email || "", role: u.role as "admin" | "hr" }}
      unreadCount={unreadCount}
    >
      {children}
    </AppShell>
  );
}
