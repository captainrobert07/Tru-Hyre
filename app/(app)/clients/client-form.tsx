import Link from "next/link";
import { SubmitButton } from "@/components/submit-button";

type Initial = {
  name?: string;
  industry?: string | null;
  website?: string | null;
  primaryContactName?: string | null;
  primaryContactEmail?: string | null;
  primaryContactPhone?: string | null;
  notes?: string | null;
};

export function ClientForm({
  action,
  initial,
}: {
  action: (formData: FormData) => void | Promise<void>;
  initial?: Initial;
}) {
  const v = initial || {};
  return (
    <form action={action} className="card p-6 max-w-2xl space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="md:col-span-2">
          <label htmlFor="name" className="label">Name</label>
          <input id="name" name="name" required defaultValue={v.name || ""} className="input" />
        </div>
        <div>
          <label htmlFor="industry" className="label">Industry</label>
          <input id="industry" name="industry" defaultValue={v.industry || ""} className="input" />
        </div>
        <div>
          <label htmlFor="website" className="label">Website</label>
          <input id="website" name="website" type="url" defaultValue={v.website || ""} className="input" />
        </div>
        <div>
          <label htmlFor="primaryContactName" className="label">Primary contact</label>
          <input id="primaryContactName" name="primaryContactName" defaultValue={v.primaryContactName || ""} className="input" />
        </div>
        <div>
          <label htmlFor="primaryContactEmail" className="label">Contact email</label>
          <input id="primaryContactEmail" name="primaryContactEmail" type="email" defaultValue={v.primaryContactEmail || ""} className="input" />
        </div>
        <div className="md:col-span-2">
          <label htmlFor="primaryContactPhone" className="label">Contact phone</label>
          <input id="primaryContactPhone" name="primaryContactPhone" defaultValue={v.primaryContactPhone || ""} className="input" />
        </div>
        <div className="md:col-span-2">
          <label htmlFor="notes" className="label">Notes</label>
          <textarea id="notes" name="notes" rows={3} defaultValue={v.notes || ""} className="input py-2" />
        </div>
      </div>
      <div className="flex gap-2 pt-2">
        <SubmitButton pendingLabel="Saving…">Save</SubmitButton>
        <Link href="/clients" className="btn-ghost">Cancel</Link>
      </div>
    </form>
  );
}
