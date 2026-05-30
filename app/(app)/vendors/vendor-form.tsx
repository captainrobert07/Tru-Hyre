import Link from "next/link";

type Initial = {
  name?: string;
  contactName?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  country?: string | null;
  notes?: string | null;
};

export function VendorForm({
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
          <label htmlFor="contactName" className="label">Contact name</label>
          <input id="contactName" name="contactName" defaultValue={v.contactName || ""} className="input" />
        </div>
        <div>
          <label htmlFor="country" className="label">Country</label>
          <input id="country" name="country" defaultValue={v.country || ""} className="input" />
        </div>
        <div>
          <label htmlFor="contactEmail" className="label">Contact email</label>
          <input id="contactEmail" name="contactEmail" type="email" defaultValue={v.contactEmail || ""} className="input" />
        </div>
        <div>
          <label htmlFor="contactPhone" className="label">Contact phone</label>
          <input id="contactPhone" name="contactPhone" defaultValue={v.contactPhone || ""} className="input" />
        </div>
        <div className="md:col-span-2">
          <label htmlFor="notes" className="label">Notes</label>
          <textarea id="notes" name="notes" rows={3} defaultValue={v.notes || ""} className="input py-2" />
        </div>
      </div>
      <div className="flex gap-2 pt-2">
        <button type="submit" className="btn-primary">Save</button>
        <Link href="/vendors" className="btn-ghost">Cancel</Link>
      </div>
    </form>
  );
}
