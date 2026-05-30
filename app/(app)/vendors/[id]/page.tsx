import { eq, desc } from "drizzle-orm";
import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/db";
import { vendorAccounts, candidates, jobs, jobVendors } from "@/db/schema";
import { requireStaff } from "@/lib/rbac";
import { PageHeader, ListRow, StageBadge, JobStatusBadge, EmptyState } from "@/components/primitives";

export const dynamic = "force-dynamic";

export default async function VendorDetail({ params }: { params: Promise<{ id: string }> }) {
  await requireStaff();
  const { id } = await params;
  const vendorId = Number(id);
  const v = (await db.select().from(vendorAccounts).where(eq(vendorAccounts.id, vendorId)))[0];
  if (!v) notFound();

  const [vendorCandidates, vendorJobs] = await Promise.all([
    db
      .select({ id: candidates.id, fullName: candidates.fullName, currentTitle: candidates.currentTitle, stage: candidates.stage })
      .from(candidates)
      .where(eq(candidates.vendorAccountId, vendorId))
      .orderBy(desc(candidates.createdAt))
      .limit(50),
    db
      .select({ id: jobs.id, title: jobs.title, status: jobs.status, location: jobs.location })
      .from(jobVendors)
      .innerJoin(jobs, eq(jobVendors.jobId, jobs.id))
      .where(eq(jobVendors.vendorAccountId, vendorId))
      .orderBy(desc(jobs.createdAt)),
  ]);

  return (
    <>
      <PageHeader
        title={v.name}
        subtitle={[v.country, v.contactName].filter(Boolean).join(" · ") || undefined}
        actions={<Link href={`/vendors/${v.id}/edit`} className="btn-ghost">Edit</Link>}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Section title="Profile">
          <Field label="Contact">{v.contactName || "—"}</Field>
          <Field label="Email">{v.contactEmail || "—"}</Field>
          <Field label="Phone">{v.contactPhone || "—"}</Field>
          <Field label="Country">{v.country || "—"}</Field>
          {v.notes && (
            <div className="pt-3 border-t border-hairline mt-3">
              <div className="text-xs text-ink-muted uppercase tracking-wide mb-1">Notes</div>
              <p className="text-sm whitespace-pre-line">{v.notes}</p>
            </div>
          )}
        </Section>

        <Section title="Assigned jobs">
          {vendorJobs.length === 0 ? (
            <EmptyState title="No jobs assigned" />
          ) : (
            <div className="-mx-4 -mb-4 divide-y divide-hairline">
              {vendorJobs.map((j) => (
                <ListRow
                  key={j.id}
                  href={`/jobs/${j.id}`}
                  primary={j.title}
                  secondary={j.location || "—"}
                  trailing={<JobStatusBadge status={j.status} />}
                />
              ))}
            </div>
          )}
        </Section>

        <Section title="Candidates submitted by this vendor" className="lg:col-span-2">
          {vendorCandidates.length === 0 ? (
            <EmptyState title="No candidates yet" />
          ) : (
            <div className="-mx-4 -mb-4 divide-y divide-hairline">
              {vendorCandidates.map((c) => (
                <ListRow
                  key={c.id}
                  href={`/candidates/${c.id}`}
                  primary={c.fullName}
                  secondary={c.currentTitle || "—"}
                  trailing={<StageBadge stage={c.stage} />}
                />
              ))}
            </div>
          )}
        </Section>
      </div>
    </>
  );
}

function Section({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`card p-4 ${className || ""}`}>
      <h2 className="text-sm font-semibold mb-3">{title}</h2>
      {children}
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-3 gap-2 py-1.5 text-sm">
      <div className="text-ink-muted text-xs uppercase tracking-wide pt-0.5">{label}</div>
      <div className="col-span-2 text-ink truncate">{children}</div>
    </div>
  );
}
