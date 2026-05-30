import { eq, desc } from "drizzle-orm";
import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/db";
import { jobs, clientAccounts, jobVendors, vendorAccounts, submissions, candidates } from "@/db/schema";
import { requireStaff } from "@/lib/rbac";
import { PageHeader, JobStatusBadge, Badge, StatCard } from "@/components/primitives";
import { Breadcrumbs } from "@/components/breadcrumbs";

export const dynamic = "force-dynamic";

export default async function JobDetail({ params }: { params: Promise<{ id: string }> }) {
  await requireStaff();
  const { id } = await params;
  const jobId = Number(id);
  const j = (
    await db
      .select({
        id: jobs.id,
        title: jobs.title,
        status: jobs.status,
        priority: jobs.priority,
        location: jobs.location,
        workMode: jobs.workMode,
        experienceMin: jobs.experienceMin,
        experienceMax: jobs.experienceMax,
        ctcMin: jobs.ctcMin,
        ctcMax: jobs.ctcMax,
        positions: jobs.positions,
        description: jobs.description,
        skills: jobs.skills,
        closeBy: jobs.closeBy,
        clientName: clientAccounts.name,
        clientId: clientAccounts.id,
      })
      .from(jobs)
      .leftJoin(clientAccounts, eq(jobs.clientAccountId, clientAccounts.id))
      .where(eq(jobs.id, jobId))
  )[0];
  if (!j) notFound();

  const [vendorRows, subs] = await Promise.all([
    db
      .select({ id: vendorAccounts.id, name: vendorAccounts.name })
      .from(jobVendors)
      .innerJoin(vendorAccounts, eq(jobVendors.vendorAccountId, vendorAccounts.id))
      .where(eq(jobVendors.jobId, jobId)),
    db
      .select({
        id: submissions.id,
        candidateId: submissions.candidateId,
        candidateName: candidates.fullName,
        status: submissions.status,
        createdAt: submissions.createdAt,
      })
      .from(submissions)
      .innerJoin(candidates, eq(submissions.candidateId, candidates.id))
      .where(eq(submissions.jobId, jobId))
      .orderBy(desc(submissions.createdAt)),
  ]);

  return (
    <>
      <Breadcrumbs
        crumbs={[
          { href: "/dashboard", label: "Dashboard" },
          { href: "/jobs", label: "Jobs" },
          { label: j.title },
        ]}
      />
      <PageHeader
        title={j.title}
        subtitle={
          <span className="flex items-center gap-2">
            <Link href={`/clients/${j.clientId}`} className="text-brand-700 hover:underline">{j.clientName}</Link>
            <JobStatusBadge status={j.status} />
            <Badge tone="gray">{j.priority}</Badge>
          </span>
        }
        actions={
          <>
            <Link href={`/jobs/${j.id}/kanban`} className="btn-ghost">Pipeline</Link>
            <Link href={`/jobs/${j.id}/edit`} className="btn-ghost">Edit</Link>
          </>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <StatCard label="Positions" value={j.positions} />
        <StatCard label="Experience" value={j.experienceMin ? `${j.experienceMin}–${j.experienceMax || "?"} yrs` : "—"} />
        <StatCard label="CTC range" value={j.ctcMin ? `${fmt(j.ctcMin)}–${fmt(j.ctcMax)}` : "—"} />
        <StatCard label="Submissions" value={subs.length} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 card p-4">
          <h2 className="text-sm font-semibold mb-3">Description</h2>
          <p className="text-sm leading-relaxed text-ink-soft whitespace-pre-line">{j.description || "—"}</p>
          {j.skills && j.skills.length > 0 && (
            <div className="mt-4 pt-4 border-t border-hairline">
              <h3 className="text-xs uppercase tracking-wide text-ink-muted mb-2">Skills</h3>
              <div className="flex flex-wrap gap-1.5">
                {j.skills.map((s) => <Badge key={s} tone="blue">{s}</Badge>)}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <section className="card p-4">
            <h3 className="text-sm font-semibold mb-2">Assigned vendors</h3>
            {vendorRows.length === 0 ? <div className="text-sm text-ink-soft">None.</div> : (
              <div className="flex flex-wrap gap-1.5">
                {vendorRows.map((v) => <Badge key={v.id} tone="default">{v.name}</Badge>)}
              </div>
            )}
          </section>
          <section className="card p-4">
            <h3 className="text-sm font-semibold mb-2">Pipeline</h3>
            {subs.length === 0 ? <div className="text-sm text-ink-soft">No submissions.</div> : (
              <ul className="text-sm divide-y divide-hairline -mx-1">
                {subs.map((s) => (
                  <li key={s.id} className="px-1 py-2 flex justify-between items-center">
                    <Link href={`/candidates/${s.candidateId}`} className="text-brand-700 hover:underline truncate max-w-[60%]">
                      {s.candidateName}
                    </Link>
                    <Badge tone="blue">{s.status}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </>
  );
}

function fmt(v: string | null) {
  if (!v) return "?";
  const n = Number(v);
  if (Number.isNaN(n)) return v;
  return n.toLocaleString();
}
