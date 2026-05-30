import { eq, desc, count } from "drizzle-orm";
import Link from "next/link";
import { db } from "@/db";
import { users, vendorAccounts, candidates, jobs, jobVendors, submissions } from "@/db/schema";
import { requireVendor } from "@/lib/rbac";
import { PageHeader, StageBadge, JobStatusBadge, EmptyState, StatCard, Badge } from "@/components/primitives";
import { signOut } from "@/auth";
import { APP_NAME } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function VendorPortal() {
  const user = await requireVendor();
  const u = (await db.select().from(users).where(eq(users.id, Number(user.id))))[0];
  if (!u || !u.vendorAccountId) {
    return <NoAccountState email={user.email} />;
  }
  const vendor = (await db.select().from(vendorAccounts).where(eq(vendorAccounts.id, u.vendorAccountId)))[0];

  const [assignedJobs, myCandidates, mySubmissions, totalCandsRow] = await Promise.all([
    db
      .select({ id: jobs.id, title: jobs.title, status: jobs.status, location: jobs.location, positions: jobs.positions })
      .from(jobVendors)
      .innerJoin(jobs, eq(jobVendors.jobId, jobs.id))
      .where(eq(jobVendors.vendorAccountId, u.vendorAccountId))
      .orderBy(desc(jobs.createdAt)),
    db
      .select({ id: candidates.id, fullName: candidates.fullName, currentTitle: candidates.currentTitle, stage: candidates.stage, refId: candidates.refId })
      .from(candidates)
      .where(eq(candidates.vendorAccountId, u.vendorAccountId))
      .orderBy(desc(candidates.createdAt))
      .limit(50),
    db
      .select({ status: submissions.status, n: count() })
      .from(submissions)
      .innerJoin(candidates, eq(submissions.candidateId, candidates.id))
      .where(eq(candidates.vendorAccountId, u.vendorAccountId))
      .groupBy(submissions.status),
    db.select({ n: count() }).from(candidates).where(eq(candidates.vendorAccountId, u.vendorAccountId)),
  ]);

  const submitted = mySubmissions.find((s) => s.status === "submitted")?.n ?? 0;
  const shortlisted = mySubmissions.find((s) => s.status === "shortlist")?.n ?? 0;
  const offered = (mySubmissions.find((s) => s.status === "offer")?.n ?? 0) + (mySubmissions.find((s) => s.status === "joined")?.n ?? 0);

  return (
    <main className="min-h-screen bg-canvas">
      <header className="bg-surface border-b border-hairline">
        <div className="max-w-5xl mx-auto px-4 md:px-8 h-14 flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold">{APP_NAME} · Vendor Portal</div>
            <div className="text-xs text-ink-soft">{vendor?.name}</div>
          </div>
          <form action={async () => { "use server"; await signOut({ redirectTo: "/login" }); }}>
            <button type="submit" className="text-xs text-ink-soft hover:text-ink">Sign out</button>
          </form>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 md:px-8 py-6 md:py-8">
        <PageHeader
          title={`Welcome, ${u.fullName}`}
          subtitle="Your assigned jobs and candidates."
          actions={<Link href="/portal/vendor/upload" className="btn-brand">Submit candidate</Link>}
        />

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <StatCard label="Open jobs" value={assignedJobs.filter((j) => j.status === "open").length} />
          <StatCard label="Candidates" value={totalCandsRow[0]?.n ?? 0} />
          <StatCard label="In review" value={submitted + shortlisted} />
          <StatCard label="Offered/Joined" value={offered} />
        </div>

        <div className="card overflow-hidden mb-6">
          <div className="px-4 py-3 border-b border-hairline text-sm font-semibold">Open jobs assigned to you</div>
          {assignedJobs.length === 0 ? (
            <EmptyState title="No assignments yet" description="A Tru Hyre admin will assign you to roles you can submit candidates for." />
          ) : (
            <div className="divide-y divide-hairline">
              {assignedJobs.map((j) => (
                <Link
                  key={j.id}
                  href={`/portal/vendor/jobs/${j.id}`}
                  className="px-4 py-3 flex justify-between items-center hover:bg-canvas transition-colors"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{j.title}</div>
                    <div className="text-xs text-ink-soft">{[j.location, `${j.positions} position${j.positions === 1 ? "" : "s"}`].filter(Boolean).join(" · ")}</div>
                  </div>
                  <JobStatusBadge status={j.status} />
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="card overflow-hidden">
          <div className="px-4 py-3 border-b border-hairline flex items-center justify-between">
            <div className="text-sm font-semibold">Your candidates</div>
            <Badge tone="default">{myCandidates.length}</Badge>
          </div>
          {myCandidates.length === 0 ? (
            <EmptyState title="No candidates submitted yet" description={`${APP_NAME} HR will reach out with submission details.`} />
          ) : (
            <div className="divide-y divide-hairline">
              {myCandidates.map((c) => (
                <div key={c.id} className="px-4 py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate flex items-center gap-2">
                      {c.fullName}
                      <span className="text-[10px] text-ink-muted font-mono">{c.refId}</span>
                    </div>
                    <div className="text-xs text-ink-soft truncate">{c.currentTitle || "—"}</div>
                  </div>
                  <StageBadge stage={c.stage} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

function NoAccountState({ email }: { email: string }) {
  return (
    <main className="login-bg min-h-screen flex items-center justify-center px-4">
      <div className="card max-w-md p-8 space-y-2">
        <h1 className="text-xl font-semibold">No vendor account linked</h1>
        <p className="text-sm text-ink-soft">Your account ({email}) isn&apos;t linked to a vendor. Contact your Tru Hyre admin.</p>
        <Link href="/login" className="btn-ghost text-sm mt-2 inline-block">Back to sign in</Link>
      </div>
    </main>
  );
}
