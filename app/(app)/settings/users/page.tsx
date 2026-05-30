import { desc, eq } from "drizzle-orm";
import Link from "next/link";
import { db } from "@/db";
import { users, clientAccounts, vendorAccounts } from "@/db/schema";
import { requireAdmin } from "@/lib/rbac";
import { PageHeader, Badge } from "@/components/primitives";
import { UserRowActions } from "./users-row-actions";
import {
  startImpersonation,
  deactivateUserAction,
  forcePasswordResetAction,
} from "./[id]/admin-actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Users" };

export default async function UsersPage() {
  const me = await requireAdmin();
  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      fullName: users.fullName,
      role: users.role,
      isActive: users.isActive,
      clientName: clientAccounts.name,
      vendorName: vendorAccounts.name,
    })
    .from(users)
    .leftJoin(clientAccounts, eq(users.clientAccountId, clientAccounts.id))
    .leftJoin(vendorAccounts, eq(users.vendorAccountId, vendorAccounts.id))
    .orderBy(desc(users.createdAt));

  return (
    <>
      <PageHeader
        title="Users"
        subtitle={`${rows.length} user${rows.length === 1 ? "" : "s"}`}
        actions={
          <>
            <Link href="/settings/invitations/bulk" className="btn-ghost">Bulk invite</Link>
            <Link href="/settings/users/new" className="btn-primary">New user</Link>
          </>
        }
      />
      <div className="card overflow-hidden divide-y divide-hairline">
        {rows.map((u) => (
          <div
            key={u.id}
            className="grid grid-cols-12 items-center gap-3 px-4 py-3 hover:bg-canvas transition-colors text-sm"
          >
            <Link href={`/settings/users/${u.id}/edit`} className="col-span-12 md:col-span-4 min-w-0">
              <div className="font-medium truncate">{u.fullName}</div>
              <div className="text-xs text-ink-soft truncate">{u.email}</div>
            </Link>
            <div className="col-span-6 md:col-span-3">
              <Badge tone={u.role === "admin" ? "blue" : u.role === "hr" ? "default" : u.role === "client" ? "green" : "amber"}>
                {u.role}
              </Badge>
            </div>
            <div className="col-span-6 md:col-span-3 text-xs text-ink-soft truncate">
              {u.clientName || u.vendorName || "—"}
            </div>
            <div className="col-span-6 md:col-span-1 flex justify-end">
              {u.isActive ? <Badge tone="green">active</Badge> : <Badge tone="red">disabled</Badge>}
            </div>
            <div className="col-span-6 md:col-span-1 flex justify-end">
              <UserRowActions
                userId={u.id}
                email={u.email}
                isActive={u.isActive}
                isMe={Number(me.id) === u.id}
                onImpersonate={async () => {
                  "use server";
                  await startImpersonation(u.id);
                }}
                onDeactivate={async () => {
                  "use server";
                  await deactivateUserAction(u.id);
                }}
                onReset={async () => {
                  "use server";
                  await forcePasswordResetAction(u.id);
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
