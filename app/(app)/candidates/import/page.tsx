import Link from "next/link";
import { requireStaff } from "@/lib/rbac";
import { PageHeader } from "@/components/primitives";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { ImportForm } from "./import-form";

export const metadata = { title: "Import candidates" };

export default async function ImportPage() {
  await requireStaff();
  return (
    <>
      <Breadcrumbs
        crumbs={[
          { href: "/dashboard", label: "Dashboard" },
          { href: "/candidates", label: "Candidates" },
          { label: "Import" },
        ]}
      />
      <PageHeader
        title="Import candidates"
        subtitle="Bulk-load candidates from a spreadsheet. Up to 5 MB, ~5000 rows per import."
        actions={<Link href="/candidates" className="btn-ghost">Back</Link>}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 card p-6">
          <ImportForm />
        </div>

        <div className="card p-5 space-y-3 text-sm">
          <h2 className="text-sm font-semibold">Expected columns</h2>
          <p className="text-xs text-ink-soft">
            Header row required. Order doesn&apos;t matter. Unknown columns are ignored.
            Skills and tags are comma-separated within a quoted cell.
          </p>
          <ul className="text-xs space-y-1 text-ink">
            <li><span className="font-mono text-brand-700">fullName</span> <span className="text-ink-muted">(required)</span></li>
            <li><span className="font-mono">email</span></li>
            <li><span className="font-mono">phone</span></li>
            <li><span className="font-mono">location</span></li>
            <li><span className="font-mono">currentTitle</span></li>
            <li><span className="font-mono">currentCompany</span></li>
            <li><span className="font-mono">experienceYears</span></li>
            <li><span className="font-mono">noticePeriodDays</span></li>
            <li><span className="font-mono">currentCtc</span> <span className="text-ink-muted">/</span> <span className="font-mono">expectedCtc</span></li>
            <li><span className="font-mono">summary</span></li>
            <li><span className="font-mono">skills</span> <span className="text-ink-muted">"Java, Kafka, AWS"</span></li>
            <li><span className="font-mono">tags</span> <span className="text-ink-muted">"reapplicant, internal"</span></li>
            <li><span className="font-mono">linkedinUrl</span> <span className="text-ink-muted">/</span> <span className="font-mono">githubUrl</span></li>
          </ul>
          <p className="text-[11px] text-ink-muted pt-2 border-t border-hairline">
            All imports land at <span className="font-medium">received</span> stage and are
            audit-logged. No PDF is stored — pair with the upload flow if you need the
            original document.
          </p>
        </div>
      </div>
    </>
  );
}
