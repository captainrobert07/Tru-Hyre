import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/db";
import { candidates } from "@/db/schema";
import { requireStaff } from "@/lib/rbac";
import { PageHeader } from "@/components/primitives";
import { updateCandidateAction } from "../actions";

export const metadata = { title: "Edit candidate" };

export default async function EditCandidatePage({ params }: { params: Promise<{ id: string }> }) {
  await requireStaff();
  const { id } = await params;
  const candidateId = Number(id);
  const c = (await db.select().from(candidates).where(eq(candidates.id, candidateId)))[0];
  if (!c) notFound();

  return (
    <>
      <PageHeader title={`Edit ${c.fullName}`} subtitle={<span className="font-mono text-xs">{c.refId}</span>} />
      <form action={updateCandidateAction.bind(null, candidateId)} className="card p-6 max-w-3xl space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field name="fullName" label="Full name" defaultValue={c.fullName} required />
          <Field name="email" label="Email" defaultValue={c.email || ""} type="email" />
          <Field name="phone" label="Phone" defaultValue={c.phone || ""} />
          <Field name="location" label="Location" defaultValue={c.location || ""} />
          <Field name="currentTitle" label="Current title" defaultValue={c.currentTitle || ""} />
          <Field name="currentCompany" label="Current company" defaultValue={c.currentCompany || ""} />
          <Field name="experienceYears" label="Experience (yrs)" defaultValue={c.experienceYears || ""} />
          <Field name="noticePeriodDays" label="Notice (days)" defaultValue={c.noticePeriodDays?.toString() || ""} type="number" />
          <Field name="currentCtc" label="Current CTC" defaultValue={c.currentCtc || ""} />
          <Field name="expectedCtc" label="Expected CTC" defaultValue={c.expectedCtc || ""} />
        </div>

        <div>
          <label className="label">Skills (comma-separated)</label>
          <input name="skillsCsv" defaultValue={(c.skills || []).join(", ")} className="input" />
        </div>

        <div>
          <label className="label">Summary</label>
          <textarea name="summary" defaultValue={c.summary || ""} rows={3} className="input py-2" />
        </div>

        <div>
          <label className="label">Internal notes (HR/admin only)</label>
          <textarea name="notes" defaultValue={c.notes || ""} rows={3} className="input py-2" />
        </div>

        <div className="flex gap-2 pt-2">
          <button type="submit" className="btn-primary">Save changes</button>
          <Link href={`/candidates/${candidateId}`} className="btn-ghost">Cancel</Link>
        </div>
      </form>
    </>
  );
}

function Field({ name, label, defaultValue, type = "text", required = false }: { name: string; label: string; defaultValue: string; type?: string; required?: boolean }) {
  return (
    <div>
      <label htmlFor={name} className="label">{label}</label>
      <input id={name} name={name} type={type} defaultValue={defaultValue} required={required} className="input" />
    </div>
  );
}
