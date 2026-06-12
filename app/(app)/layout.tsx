import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { and, eq, isNull, count } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { notifications } from "@/db/schema";
import { AppShell } from "@/components/app-shell";
import { getMyActionItemCount } from "@/lib/metrics";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const u = session.user as { id?: string; fullName?: string; email?: string; role?: string };
  if (!u.role) redirect("/login");
  if (u.role === "client") redirect("/portal/client");
  if (u.role === "vendor") redirect("/portal/vendor");

  let unreadCount = 0;
  let inboxCount = 0;
  if (u.id) {
    try {
      const [r, ic] = await Promise.all([
        db
          .select({ n: count() })
          .from(notifications)
          .where(and(eq(notifications.userId, Number(u.id)), isNull(notifications.readAt))),
        getMyActionItemCount(Number(u.id)),
      ]);
      unreadCount = r[0]?.n ?? 0;
      inboxCount = ic;
    } catch {
      unreadCount = 0;
      inboxCount = 0;
    }
  }

  return (
    <AppShell
      user={{ fullName: u.fullName || u.email || "", email: u.email || "", role: u.role as "admin" | "hr" }}
      unreadCount={unreadCount}
      inboxCount={inboxCount}
    >
      {children}
    </AppShell>
  );
}
