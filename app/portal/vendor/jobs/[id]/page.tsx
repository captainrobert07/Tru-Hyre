import Link from "next/link";
import { eq, and } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { users, jobs, jobVendors, clientAccounts } from "@/db/schema";
import { requireVendor } from "@/lib/rbac";
import { signOut } from "@/auth";
import { APP_NAME } from "@/lib/utils";
import { Badge, JobStatusBadge } from "@/components/primitives";

export const dynamic = "force-dynamic";

export default async function VendorJobSpec({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireVendor();
  const { id } = await params;
  const jobId = Number(id);
  if (!Number.isFinite(jobId)) notFound();

  const u = (await db.select().from(users).where(eq(users.id, Number(me.id))))[0];
  if (!u || !u.vendorAccountId) notFound();

  // Ensure the vendor is actually assigned to this job
  const assigned = (await db
    .select()
    .from(jobVendors)
    .where(and(eq(jobVendors.jobId, jobId), eq(jobVendors.vendorAccountId, u.vendorAccountId)))
  )[0];
  if (!assigned) notFound();

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
      })
      .from(jobs)
      .leftJoin(clientAccounts, eq(jobs.clientAccountId, clientAccounts.id))
      .where(eq(jobs.id, jobId))
  )[0];
  if (!j) notFound();

  return (
    <main className="min-h-screen bg-canvas">
      <header className="bg-surface border-b border-hairline">
        <div className="max-w-4xl mx-auto px-4 md:px-8 h-14 flex items-center justify-between">
          <Link href="/portal/vendor" className="text-sm font-semibold">← {APP_NAME} · Vendor Portal</Link>
          <form action={async () => { "use server"; await signOut({ redirectTo: "/login" }); }}>
            <button type="submit" className="text-xs text-ink-soft hover:text-ink">Sign out</button>
          </form>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 md:px-8 py-6 md:py-10">
        <div className="mb-6">
          <h1 className="display text-3xl md:text-4xl">{j.title}</h1>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <Badge tone="default">{j.clientName || "—"}</Badge>
            <JobStatusBadge status={j.status} />
            <Badge tone="gray">{j.priority}</Badge>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <Stat label="Positions" value={j.positions} />
          <Stat label="Experience" value={j.experienceMin ? `${j.experienceMin}-${j.experienceMax || "?"} yrs` : "—"} />
          <Stat label="Location" value={j.location || "—"} />
          <Stat label="Work mode" value={j.workMode || "—"} />
        </div>

        {j.description && (
          <section className="card p-5 mb-4">
            <h2 className="text-sm font-semibold mb-3">Description</h2>
            <p className="text-sm leading-relaxed text-ink-soft whitespace-pre-line">{j.description}</p>
          </section>
        )}

        {j.skills && j.skills.length > 0 && (
          <section className="card p-5 mb-4">
            <h2 className="text-sm font-semibold mb-3">Skills wanted</h2>
            <div className="flex flex-wrap gap-1.5">
              {j.skills.map((s) => <Badge key={s} tone="green">{s}</Badge>)}
            </div>
          </section>
        )}

        <div className="flex gap-2 mt-6">
          <Link href="/portal/vendor/upload" className="btn-brand">Submit a candidate for this role</Link>
          <Link href="/portal/vendor" className="btn-ghost">Back to portal</Link>
        </div>

        {j.closeBy && (
          <p className="text-xs text-ink-muted mt-4">Close-by date: {new Date(j.closeBy).toLocaleDateString()}</p>
        )}
      </div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="card p-4">
      <div className="text-[11px] text-ink-muted uppercase tracking-wide">{label}</div>
      <div className="text-base font-semibold mt-1">{value}</div>
    </div>
  );
}
