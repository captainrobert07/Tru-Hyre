import Link from "next/link";
import { requireAdmin } from "@/lib/rbac";
import { PageHeader } from "@/components/primitives";
import { SubmitButton } from "@/components/submit-button";
import { bulkInviteAction, listAccountOptions } from "../../actions";

export const metadata = { title: "Bulk invite" };

export default async function BulkInvitePage() {
  await requireAdmin();
  const { clients, vendors } = await listAccountOptions();
  return (
    <>
      <PageHeader title="Bulk invite users" subtitle="Paste emails separated by commas, semicolons, spaces, or newlines." />
      <form action={bulkInviteAction} className="card p-6 max-w-2xl space-y-4">
        <div>
          <label htmlFor="emails" className="label">Emails</label>
          <textarea
            id="emails"
            name="emails"
            rows={8}
            required
            className="input py-2 font-mono text-xs"
            placeholder="alice@example.com&#10;bob@example.com&#10;carol@example.com"
          />
          <p className="text-xs text-ink-muted mt-1.5">
            Up to ~200 emails per batch. Duplicates and malformed addresses are silently dropped.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label htmlFor="role" className="label">Role for all</label>
            <select id="role" name="role" defaultValue="hr" className="input">
              <option value="admin">Admin</option>
              <option value="hr">HR / Recruiter (full)</option>
              <option value="hr_lite">HR Lite (own resumes only)</option>
              <option value="client">Client</option>
              <option value="vendor">Vendor</option>
            </select>
          </div>
          <div>
            <label htmlFor="clientAccountId" className="label">Client account</label>
            <select id="clientAccountId" name="clientAccountId" defaultValue="none" className="input">
              <option value="none">— None —</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="vendorAccountId" className="label">Vendor account</label>
            <select id="vendorAccountId" name="vendorAccountId" defaultValue="none" className="input">
              <option value="none">— None —</option>
              {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
          </div>
        </div>
        <div className="flex gap-2 pt-2">
          <SubmitButton pendingLabel="Sending…">Send invitations</SubmitButton>
          <Link href="/settings/invitations" className="btn-ghost">Cancel</Link>
        </div>
      </form>
    </>
  );
}
