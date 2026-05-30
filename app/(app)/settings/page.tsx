import Link from "next/link";
import { count } from "drizzle-orm";
import { db } from "@/db";
import { users, invitations, auditLog } from "@/db/schema";
import { requireAdmin } from "@/lib/rbac";
import { PageHeader, StatCard } from "@/components/primitives";
import { Users, MailPlus, Building2, ScrollText, ChevronRight } from "lucide-react";

export const dynamic = "force-dynamic";
export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  await requireAdmin();
  const [userCount, invCount, auditCount] = await Promise.all([
    db.select({ n: count() }).from(users),
    db.select({ n: count() }).from(invitations),
    db.select({ n: count() }).from(auditLog),
  ]);

  return (
    <>
      <PageHeader title="Settings" subtitle="Admin controls" />

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
        <StatCard label="Users" value={userCount[0]?.n ?? 0} />
        <StatCard label="Invitations" value={invCount[0]?.n ?? 0} />
        <StatCard label="Audit log" value={auditCount[0]?.n ?? 0} hint="entries" />
      </div>

      <div className="card divide-y divide-hairline">
        <SectionLink href="/settings/users" icon={<Users size={18} />} title="Users" subtitle="Manage user accounts and roles" />
        <SectionLink href="/settings/invitations" icon={<MailPlus size={18} />} title="Invitations" subtitle="Send + revoke role-locked invites" />
        <SectionLink href="/settings/company" icon={<Building2 size={18} />} title="Company" subtitle="Brand and parsing toggles" />
        <SectionLink href="/settings/audit" icon={<ScrollText size={18} />} title="Audit log" subtitle="Append-only activity record" />
      </div>
    </>
  );
}

function SectionLink({ href, icon, title, subtitle }: { href: string; icon: React.ReactNode; title: string; subtitle: string }) {
  return (
    <Link href={href} className="flex items-center gap-3 px-4 py-3 hover:bg-canvas transition-colors">
      <span className="size-9 rounded-lg bg-canvas border border-hairline flex items-center justify-center text-ink-soft">{icon}</span>
      <span className="flex-1 min-w-0">
        <span className="block text-sm font-medium">{title}</span>
        <span className="block text-xs text-ink-soft">{subtitle}</span>
      </span>
      <ChevronRight size={16} className="text-ink-muted" />
    </Link>
  );
}
