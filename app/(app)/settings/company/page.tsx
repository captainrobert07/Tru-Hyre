import Link from "next/link";
import { db } from "@/db";
import { companyProfile } from "@/db/schema";
import { requireAdmin } from "@/lib/rbac";
import { PageHeader } from "@/components/primitives";
import { updateCompanyProfileAction } from "../actions";

export const metadata = { title: "Company" };

export default async function CompanyPage() {
  await requireAdmin();
  const p = (await db.select().from(companyProfile).limit(1))[0];
  if (!p) {
    return (
      <>
        <PageHeader title="Company" />
        <div className="card p-6 text-sm text-ink-soft">
          No company profile row yet. Re-run the seed.
        </div>
      </>
    );
  }
  return (
    <>
      <PageHeader title="Company" subtitle="Brand and parsing toggles." />
      <form action={updateCompanyProfileAction.bind(null, p.id)} className="card p-6 max-w-2xl space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label htmlFor="name" className="label">Company name</label>
            <input id="name" name="name" required defaultValue={p.name} className="input" />
          </div>
          <div className="md:col-span-2">
            <label htmlFor="tagline" className="label">Tagline</label>
            <input id="tagline" name="tagline" defaultValue={p.tagline || ""} className="input" />
          </div>
          <div className="md:col-span-2">
            <label htmlFor="contactEmail" className="label">Contact email</label>
            <input id="contactEmail" name="contactEmail" type="email" defaultValue={p.contactEmail || ""} className="input" />
          </div>
        </div>

        <fieldset className="border border-hairline rounded-xl2 p-4 space-y-3">
          <legend className="text-xs uppercase tracking-wide text-ink-muted px-1">Resume parsing</legend>
          <Toggle name="parsingEnabled" label="Regex extractor (default)" defaultChecked={p.parsingEnabled} />
          <Toggle name="ocrEnabled" label="OCR (image-only PDFs)" defaultChecked={p.ocrEnabled} hint="Phase 4 — not wired yet." />
          <Toggle name="aiParsingEnabled" label="AI-assisted parsing (Anthropic / OpenAI)" defaultChecked={p.aiParsingEnabled} hint="Phase 4 — not wired yet." />
        </fieldset>

        <div className="flex gap-2 pt-2">
          <button type="submit" className="btn-primary">Save</button>
          <Link href="/settings" className="btn-ghost">Cancel</Link>
        </div>
      </form>
    </>
  );
}

function Toggle({ name, label, defaultChecked, hint }: { name: string; label: string; defaultChecked: boolean; hint?: string }) {
  return (
    <label className="flex items-start gap-3 cursor-pointer">
      <input type="checkbox" name={name} value="true" defaultChecked={defaultChecked} className="mt-1" />
      <span className="text-sm">
        <span className="block">{label}</span>
        {hint && <span className="block text-xs text-ink-muted">{hint}</span>}
      </span>
    </label>
  );
}
