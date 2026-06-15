import Link from "next/link";

type Initial = {
  email?: string;
  fullName?: string;
  role?: string;
  clientAccountId?: number | null;
  vendorAccountId?: number | null;
  isActive?: boolean;
};

export function UserForm({
  action,
  clients,
  vendors,
  initial,
  isCreate,
}: {
  action: (formData: FormData) => void | Promise<void>;
  clients: { id: number; name: string }[];
  vendors: { id: number; name: string }[];
  initial?: Initial;
  isCreate: boolean;
}) {
  const v = initial || {};
  return (
    <form action={action} className="card p-6 max-w-2xl space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label htmlFor="fullName" className="label">Full name</label>
          <input id="fullName" name="fullName" required defaultValue={v.fullName || ""} className="input" />
        </div>
        <div>
          <label htmlFor="email" className="label">Email</label>
          <input id="email" name="email" type="email" required defaultValue={v.email || ""} className="input" />
        </div>
        <div>
          <label htmlFor="role" className="label">Role</label>
          <select id="role" name="role" defaultValue={v.role || "hr"} className="input">
            <option value="admin">Admin</option>
            <option value="hr">HR / Recruiter (full)</option>
            <option value="hr_lite">HR Lite (own resumes only)</option>
            <option value="client">Client</option>
            <option value="vendor">Vendor</option>
          </select>
        </div>
        <div>
          <label htmlFor="isActive" className="label">Active</label>
          <select id="isActive" name="isActive" defaultValue={v.isActive === false ? "false" : "true"} className="input">
            <option value="true">Active</option>
            <option value="false">Disabled</option>
          </select>
        </div>
        <div>
          <label htmlFor="clientAccountId" className="label">Client account (clients only)</label>
          <select id="clientAccountId" name="clientAccountId" defaultValue={v.clientAccountId ?? "none"} className="input">
            <option value="none">— None —</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="vendorAccountId" className="label">Vendor account (vendors only)</label>
          <select id="vendorAccountId" name="vendorAccountId" defaultValue={v.vendorAccountId ?? "none"} className="input">
            <option value="none">— None —</option>
            {vendors.map((vn) => (
              <option key={vn.id} value={vn.id}>{vn.name}</option>
            ))}
          </select>
        </div>
        <div className="md:col-span-2">
          <label htmlFor="password" className="label">{isCreate ? "Password" : "Reset password (leave blank to keep)"}</label>
          <input id="password" name="password" type="password" autoComplete="new-password" required={isCreate} minLength={8} className="input" />
        </div>
      </div>
      <div className="flex gap-2 pt-2">
        <button type="submit" className="btn-primary">{isCreate ? "Create user" : "Save changes"}</button>
        <Link href="/settings/users" className="btn-ghost">Cancel</Link>
      </div>
    </form>
  );
}
