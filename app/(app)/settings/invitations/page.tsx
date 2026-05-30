import { desc } from "drizzle-orm";
import Link from "next/link";
import { db } from "@/db";
import { invitations } from "@/db/schema";
import { requireAdmin } from "@/lib/rbac";
import { PageHeader, Badge } from "@/components/primitives";
import { revokeInvitationAction } from "../actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Invitations" };

export default async function InvitationsPage() {
  await requireAdmin();
  const rows = await db.select().from(invitations).orderBy(desc(invitations.createdAt));

  return (
    <>
      <PageHeader
        title="Invitations"
        subtitle={`${rows.length} on file`}
        actions={<Link href="/settings/invitations/new" className="btn-primary">New invitation</Link>}
      />
      {rows.length === 0 ? (
        <div className="card p-8 text-center text-sm text-ink-soft">No invitations yet.</div>
      ) : (
        <div className="card overflow-hidden divide-y divide-hairline">
          {rows.map((r) => (
            <div key={r.id} className="grid grid-cols-12 items-center gap-3 px-4 py-3 text-sm">
              <div className="col-span-12 md:col-span-5 min-w-0">
                <div className="font-medium truncate">{r.email}</div>
                <div className="text-xs text-ink-soft">expires {new Date(r.expiresAt).toLocaleDateString()}</div>
              </div>
              <div className="col-span-6 md:col-span-2"><Badge tone="default">{r.role}</Badge></div>
              <div className="col-span-6 md:col-span-3"><Badge tone={r.status === "pending" ? "amber" : r.status === "accepted" ? "green" : "gray"}>{r.status}</Badge></div>
              <div className="col-span-12 md:col-span-2 flex justify-end">
                {r.status === "pending" && (
                  <form action={revokeInvitationAction.bind(null, r.id)}>
                    <button type="submit" className="btn-ghost text-xs">Revoke</button>
                  </form>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
