import Link from "next/link";
import type { ReactNode } from "react";
import { signOut } from "@/auth";
import { APP_NAME } from "@/lib/utils";
import { MobileMore } from "./mobile-more";
import { CommandPalette, CommandTrigger } from "./command-palette";
import { ConfirmProvider } from "./confirm";
import { ShortcutHelp, ShortcutTrigger } from "./shortcut-help";
import { QuickAdd } from "./quick-add";
import { Avatar } from "./avatar";
import {
  LayoutDashboard,
  Inbox,
  Users,
  Briefcase,
  Building2,
  Truck,
  Send,
  Bell,
  BarChart3,
  Activity,
  Settings,
  LogOut,
} from "lucide-react";

type Role = "admin" | "hr" | "client" | "vendor";

const NAV: { href: string; label: string; icon: ReactNode; roles: Role[] }[] = [
  { href: "/dashboard", label: "Dashboard", icon: <LayoutDashboard size={16} />, roles: ["admin", "hr"] },
  { href: "/inbox", label: "Inbox", icon: <Inbox size={16} />, roles: ["admin", "hr"] },
  { href: "/candidates", label: "Candidates", icon: <Users size={16} />, roles: ["admin", "hr"] },
  { href: "/jobs", label: "Jobs", icon: <Briefcase size={16} />, roles: ["admin", "hr"] },
  { href: "/clients", label: "Clients", icon: <Building2 size={16} />, roles: ["admin", "hr"] },
  { href: "/vendors", label: "Vendors", icon: <Truck size={16} />, roles: ["admin", "hr"] },
  { href: "/submissions", label: "Submissions", icon: <Send size={16} />, roles: ["admin", "hr"] },
  { href: "/notifications", label: "Notifications", icon: <Bell size={16} />, roles: ["admin", "hr", "client", "vendor"] },
  { href: "/reports", label: "Reports", icon: <BarChart3 size={16} />, roles: ["admin", "hr"] },
  { href: "/activity", label: "Activity", icon: <Activity size={16} />, roles: ["admin", "hr"] },
  { href: "/settings", label: "Settings", icon: <Settings size={16} />, roles: ["admin"] },
];

function NotificationDot({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <span className="ml-1 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-semibold rounded-full bg-attention-500 text-white tabular-nums">
      {count > 99 ? "99+" : count}
    </span>
  );
}

export function AppShell({
  user,
  unreadCount,
  inboxCount,
  enabledFeatures,
  children,
}: {
  user: { fullName: string; email: string; role: Role };
  unreadCount?: number;
  inboxCount?: number;
  enabledFeatures?: { inbox?: boolean; command_palette?: boolean; analytics_reports?: boolean; activity_feed?: boolean; keyboard_shortcuts?: boolean };
  children: ReactNode;
}) {
  const inboxEnabled = enabledFeatures?.inbox ?? true;
  const paletteEnabled = enabledFeatures?.command_palette ?? true;
  const reportsEnabled = enabledFeatures?.analytics_reports ?? true;
  const activityEnabled = enabledFeatures?.activity_feed ?? true;
  const shortcutsEnabled = enabledFeatures?.keyboard_shortcuts ?? true;
  const items = NAV
    .filter((n) => n.roles.includes(user.role))
    .filter((n) => (n.href === "/inbox" ? inboxEnabled : true))
    .filter((n) => (n.href === "/reports" ? reportsEnabled : true))
    .filter((n) => (n.href === "/activity" ? activityEnabled : true));
  const unread = unreadCount ?? 0;
  const inbox = inboxCount ?? 0;
  const dotFor = (href: string) => (href === "/notifications" ? unread : href === "/inbox" ? inbox : 0);
  const primary = items.slice(0, 4);
  const overflow = items.slice(4);

  return (
    <ConfirmProvider>
    <div className="min-h-screen flex flex-col">
      {paletteEnabled && <CommandPalette />}
      {shortcutsEnabled && <ShortcutHelp />}
      {/* Top bar — desktop pill nav */}
      <header className="hidden md:flex sticky top-0 z-40 bg-canvas/80 backdrop-blur-md px-6 lg:px-10 py-4 items-center gap-4">
        <Link href="/dashboard" className="flex items-center gap-2 mr-2 shrink-0">
          <span className="size-9 rounded-2xl bg-brand-500 flex items-center justify-center text-white font-display italic text-lg">T</span>
          <span className="text-base font-semibold tracking-tight">{APP_NAME}</span>
        </Link>

        <nav className="nav-pill flex-1 max-w-fit mx-auto">
          {primary.map((n) => (
            <Link key={n.href} href={n.href} className="nav-pill-item">
              {n.label}
              <NotificationDot count={dotFor(n.href)} />
            </Link>
          ))}
          {overflow.length > 0 && (
            <details className="relative">
              <summary className="nav-pill-item list-none cursor-pointer select-none">More</summary>
              <div className="absolute right-0 top-full mt-2 w-48 card p-1.5 z-50">
                {overflow.map((n) => (
                  <Link
                    key={n.href}
                    href={n.href}
                    className="flex items-center gap-2 px-3 h-9 rounded-lg text-sm text-ink-soft hover:text-ink hover:bg-canvas"
                  >
                    <span className="text-ink-muted">{n.icon}</span>
                    {n.label}
                    <NotificationDot count={dotFor(n.href)} />
                  </Link>
                ))}
              </div>
            </details>
          )}
        </nav>

        <div className="flex items-center gap-2 shrink-0">
          {paletteEnabled && <CommandTrigger />}
          <QuickAdd />
          {shortcutsEnabled && <ShortcutTrigger />}
          <Link href="/notifications" className="relative size-10 rounded-full bg-surface border border-hairline flex items-center justify-center text-ink-soft hover:text-ink" aria-label="Notifications">
            <Bell size={16} />
            {unread > 0 && <span className="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-attention-500" />}
          </Link>
          <details className="relative">
            <summary className="list-none cursor-pointer flex items-center gap-2 pr-3 pl-1 h-10 rounded-full bg-surface border border-hairline shadow-pill">
              <Avatar name={user.fullName} email={user.email} size="md" />
              <span className="hidden lg:flex flex-col text-left leading-none gap-0.5">
                <span className="text-xs font-medium truncate max-w-[120px]">{user.fullName || user.email}</span>
                <span className="text-[10px] text-ink-muted uppercase tracking-wide">{user.role}</span>
              </span>
            </summary>
            <div className="absolute right-0 top-full mt-2 w-56 card p-3 z-50">
              <div className="px-2 pb-2 mb-2 border-b border-hairline">
                <div className="text-sm font-medium truncate">{user.fullName || user.email}</div>
                <div className="text-xs text-ink-muted truncate">{user.email}</div>
              </div>
              <form
                action={async () => {
                  "use server";
                  await signOut({ redirectTo: "/login" });
                }}
              >
                <button className="w-full flex items-center gap-2 px-2 h-9 rounded-lg text-sm text-ink-soft hover:text-ink hover:bg-canvas" type="submit">
                  <LogOut size={16} className="text-ink-muted" />
                  Sign out
                </button>
              </form>
            </div>
          </details>
        </div>
      </header>

      {/* Mobile top bar */}
      <header className="md:hidden bg-surface border-b border-hairline px-4 h-14 flex items-center justify-between sticky top-0 z-40">
        <Link href="/dashboard" className="flex items-center gap-2">
          <span className="size-7 rounded-xl bg-brand-500 flex items-center justify-center text-white font-display italic text-sm">T</span>
          <span className="text-sm font-semibold">{APP_NAME}</span>
        </Link>
        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/login" });
          }}
        >
          <button className="text-xs text-ink-soft" type="submit">Sign out</button>
        </form>
      </header>

      <div className="flex-1 px-4 md:px-8 lg:px-10 py-6 md:py-8 max-w-[1400px] w-full mx-auto">{children}</div>

      {/* Mobile bottom nav */}
      <nav className="md:hidden bg-surface border-t border-hairline grid grid-cols-5 h-14 sticky bottom-0 z-40">
        {items.slice(0, items.length > 5 ? 4 : 5).map((n) => (
          <Link key={n.href} href={n.href} className="flex flex-col items-center justify-center text-[10px] text-ink-soft gap-0.5 relative">
            <span className="text-ink-muted">{n.icon}</span>
            <span>{n.label}</span>
            {dotFor(n.href) > 0 && (
              <span className="absolute top-2 right-1/3 translate-x-2 size-1.5 rounded-full bg-attention-500" />
            )}
          </Link>
        ))}
        {items.length > 5 && (
          <MobileMore
            items={items.slice(4).map((n) => ({ href: n.href, label: n.label, icon: n.icon }))}
            unreadCount={unread}
          />
        )}
      </nav>
    </div>
    </ConfirmProvider>
  );
}
