import Link from "next/link";
import { requireAdmin } from "@/lib/rbac";
import { PageHeader } from "@/components/primitives";
import { createInvitationAction, listAccountOptions } from "../../actions";

export const metadata = { title: "New invitation" };

export default async function NewInvitationPage() {
  await requireAdmin();
  const { clients, vendors } = await listAccountOptions();
  return (
    <>
      <PageHeader title="New invitation" />
      <form action={createInvitationAction} className="card p-6 max-w-xl space-y-4">
        <div>
          <label htmlFor="email" className="label">Email</label>
          <input id="email" name="email" type="email" required className="input" />
        </div>
        <div>
          <label htmlFor="role" className="label">Role</label>
          <select id="role" name="role" defaultValue="hr" className="input">
            <option value="admin">Admin</option>
            <option value="hr">HR / Recruiter (full)</option>
            <option value="hr_lite">HR Lite (own resumes only)</option>
            <option value="client">Client</option>
            <option value="vendor">Vendor</option>
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="clientAccountId" className="label">Client (if role=client)</label>
            <select id="clientAccountId" name="clientAccountId" defaultValue="none" className="input">
              <option value="none">— None —</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="vendorAccountId" className="label">Vendor (if role=vendor)</label>
            <select id="vendorAccountId" name="vendorAccountId" defaultValue="none" className="input">
              <option value="none">— None —</option>
              {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
          </div>
        </div>
        <div className="flex gap-2 pt-2">
          <button type="submit" className="btn-primary">Send invitation</button>
          <Link href="/settings/invitations" className="btn-ghost">Cancel</Link>
        </div>
        <p className="text-xs text-ink-muted">An invitation token is generated server-side. Email delivery hooks in Phase 4 — for now copy the token from the audit log.</p>
      </form>
    </>
  );
}
