import Link from "next/link";
import type { ReactNode } from "react";
import { signOut } from "@/auth";
import {
  LayoutDashboard,
  Users,
  Briefcase,
  Building2,
  Truck,
  Send,
  Bell,
  BarChart3,
  Settings,
  LogOut,
} from "lucide-react";

type Role = "admin" | "hr" | "client" | "vendor";

const NAV: { href: string; label: string; icon: ReactNode; roles: Role[] }[] = [
  { href: "/", label: "Dashboard", icon: <LayoutDashboard size={18} />, roles: ["admin", "hr"] },
  { href: "/candidates", label: "Candidates", icon: <Users size={18} />, roles: ["admin", "hr"] },
  { href: "/jobs", label: "Jobs", icon: <Briefcase size={18} />, roles: ["admin", "hr"] },
  { href: "/clients", label: "Clients", icon: <Building2 size={18} />, roles: ["admin", "hr"] },
  { href: "/vendors", label: "Vendors", icon: <Truck size={18} />, roles: ["admin", "hr"] },
  { href: "/submissions", label: "Submissions", icon: <Send size={18} />, roles: ["admin", "hr"] },
  { href: "/notifications", label: "Notifications", icon: <Bell size={18} />, roles: ["admin", "hr", "client", "vendor"] },
  { href: "/reports", label: "Reports", icon: <BarChart3 size={18} />, roles: ["admin", "hr"] },
  { href: "/settings", label: "Settings", icon: <Settings size={18} />, roles: ["admin"] },
];

export function AppShell({
  user,
  children,
}: {
  user: { fullName: string; email: string; role: Role };
  children: ReactNode;
}) {
  const items = NAV.filter((n) => n.roles.includes(user.role));

  return (
    <div className="min-h-screen flex">
      <aside className="hidden md:flex w-64 shrink-0 flex-col bg-surface border-r border-hairline">
        <div className="px-5 py-5 border-b border-hairline">
          <Link href="/" className="block">
            <div className="text-base font-semibold tracking-tight">Tru Hyre</div>
            <div className="text-xs text-ink-soft mt-0.5">Allianz HR Platform</div>
          </Link>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {items.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className="flex items-center gap-3 px-3 h-9 rounded-lg text-sm text-ink-soft hover:text-ink hover:bg-canvas transition-colors"
            >
              <span className="text-ink-muted">{n.icon}</span>
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="border-t border-hairline p-3">
          <div className="px-2 py-2 text-xs">
            <div className="font-medium text-ink truncate">{user.fullName}</div>
            <div className="text-ink-muted truncate">{user.email}</div>
            <div className="mt-0.5 inline-flex px-1.5 py-0.5 rounded bg-canvas text-ink-soft text-[10px] uppercase tracking-wide">
              {user.role}
            </div>
          </div>
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/login" });
            }}
          >
            <button className="w-full flex items-center gap-3 px-3 h-9 rounded-lg text-sm text-ink-soft hover:text-ink hover:bg-canvas transition-colors" type="submit">
              <LogOut size={18} className="text-ink-muted" />
              Sign out
            </button>
          </form>
        </div>
      </aside>

      <main className="flex-1 min-w-0 flex flex-col">
        <div className="md:hidden bg-surface border-b border-hairline px-4 h-12 flex items-center justify-between">
          <Link href="/" className="text-sm font-semibold">Tru Hyre</Link>
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/login" });
            }}
          >
            <button className="text-xs text-ink-soft" type="submit">Sign out</button>
          </form>
        </div>
        <div className="flex-1 px-4 md:px-8 py-6 md:py-8">{children}</div>
        <nav className="md:hidden bg-surface border-t border-hairline grid grid-cols-5 h-14">
          {items.slice(0, 5).map((n) => (
            <Link key={n.href} href={n.href} className="flex flex-col items-center justify-center text-[10px] text-ink-soft gap-0.5">
              <span className="text-ink-muted">{n.icon}</span>
              <span>{n.label}</span>
            </Link>
          ))}
        </nav>
      </main>
    </div>
  );
}
