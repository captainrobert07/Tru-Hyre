import { eq, desc, inArray } from "drizzle-orm";
import Link from "next/link";
import { db } from "@/db";
import { users, jobs, submissions, candidates, clientAccounts } from "@/db/schema";
import { requireClient } from "@/lib/rbac";
import { PageHeader, ListRow, Badge, EmptyState, StatCard } from "@/components/primitives";
import { signOut } from "@/auth";
import { APP_NAME } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function ClientPortal() {
  const user = await requireClient();
  const u = (await db.select().from(users).where(eq(users.id, Number(user.id))))[0];
  if (!u || !u.clientAccountId) {
    return <NoAccountState email={user.email} />;
  }

  const account = (await db.select().from(clientAccounts).where(eq(clientAccounts.id, u.clientAccountId)))[0];

  const myJobs = await db
    .select({ id: jobs.id, title: jobs.title, status: jobs.status, location: jobs.location, positions: jobs.positions })
    .from(jobs)
    .where(eq(jobs.clientAccountId, u.clientAccountId))
    .orderBy(desc(jobs.createdAt));

  const jobIds = myJobs.map((j) => j.id);
  const subs = jobIds.length === 0
    ? []
    : await db
        .select({
          id: submissions.id,
          candidateId: submissions.candidateId,
          candidateName: candidates.fullName,
          candidateRefId: candidates.refId,
          candidateTitle: candidates.currentTitle,
          jobId: submissions.jobId,
          jobTitle: jobs.title,
          status: submissions.status,
          createdAt: submissions.createdAt,
        })
        .from(submissions)
        .innerJoin(candidates, eq(submissions.candidateId, candidates.id))
        .innerJoin(jobs, eq(submissions.jobId, jobs.id))
        .where(inArray(submissions.jobId, jobIds))
        .orderBy(desc(submissions.createdAt))
        .limit(200);

  const open = myJobs.filter((j) => j.status === "open").length;
  const submitted = subs.filter((s) => s.status === "submitted").length;
  const shortlisted = subs.filter((s) => s.status === "shortlist").length;
  const offered = subs.filter((s) => s.status === "offer" || s.status === "joined").length;

  return (
    <main className="min-h-screen bg-canvas">
      <header className="bg-surface border-b border-hairline">
        <div className="max-w-5xl mx-auto px-4 md:px-8 h-14 flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold">{APP_NAME} · Client Portal</div>
            <div className="text-xs text-ink-soft">{account?.name}</div>
          </div>
          <form action={async () => { "use server"; await signOut({ redirectTo: "/login" }); }}>
            <button type="submit" className="text-xs text-ink-soft hover:text-ink">Sign out</button>
          </form>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 md:px-8 py-6 md:py-8">
        <PageHeader title={`Welcome, ${u.fullName}`} subtitle="Submissions to your open roles." />

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <StatCard label="Open jobs" value={open} />
          <StatCard label="Submitted" value={submitted} />
          <StatCard label="Shortlisted" value={shortlisted} />
          <StatCard label="Offered/Joined" value={offered} />
        </div>

        <div className="card overflow-hidden mb-6">
          <div className="px-4 py-3 border-b border-hairline text-sm font-semibold">Submissions</div>
          {subs.length === 0 ? (
            <EmptyState title="No submissions yet" description="Tru Hyre will list candidates here as they're submitted to your roles." />
          ) : (
            <div className="divide-y divide-hairline">
              {subs.map((s) => (
                <ListRow
                  key={s.id}
                  href={`/portal/client/submissions/${s.id}`}
                  primary={
                    <span className="flex items-center gap-2">
                      <span>{s.candidateName}</span>
                      <span className="text-[10px] text-ink-muted font-mono">{s.candidateRefId}</span>
                    </span>
                  }
                  secondary={`${s.candidateTitle || "—"} · for ${s.jobTitle}`}
                  trailing={<Badge tone="blue">{s.status}</Badge>}
                />
              ))}
            </div>
          )}
        </div>

        <div className="card overflow-hidden">
          <div className="px-4 py-3 border-b border-hairline text-sm font-semibold">Your jobs</div>
          {myJobs.length === 0 ? (
            <EmptyState title="No jobs on file" />
          ) : (
            <div className="divide-y divide-hairline">
              {myJobs.map((j) => (
                <div key={j.id} className="px-4 py-3 flex justify-between items-center">
                  <div>
                    <div className="text-sm font-medium">{j.title}</div>
                    <div className="text-xs text-ink-soft">{[j.location, `${j.positions} position${j.positions === 1 ? "" : "s"}`].filter(Boolean).join(" · ")}</div>
                  </div>
                  <Badge tone={j.status === "open" ? "green" : j.status === "closed" ? "gray" : "amber"}>{j.status}</Badge>
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
        <h1 className="text-xl font-semibold">No client account linked</h1>
        <p className="text-sm text-ink-soft">Your account ({email}) isn&apos;t linked to a client. Contact your Tru Hyre admin.</p>
        <Link href="/login" className="btn-ghost text-sm mt-2 inline-block">Back to sign in</Link>
      </div>
    </main>
  );
}
