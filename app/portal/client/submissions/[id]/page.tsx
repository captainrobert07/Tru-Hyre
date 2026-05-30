import { eq, desc, and } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { db } from "@/db";
import { users, submissions, candidates, jobs, feedbackEvents, clientPackets, comments as commentsTable } from "@/db/schema";
import { requireClient } from "@/lib/rbac";
import { PageHeader, Badge, StatCard } from "@/components/primitives";
import { signOut } from "@/auth";
import { APP_NAME } from "@/lib/utils";
import { clientFeedbackAction } from "../../actions";
import { toggleStarAction, addClientInternalCommentAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function ClientSubmissionDetail({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireClient();
  const { id } = await params;
  const submissionId = Number(id);

  const row = (
    await db
      .select({
        sub: submissions,
        cand: candidates,
        job: jobs,
        packet: clientPackets,
      })
      .from(submissions)
      .innerJoin(candidates, eq(submissions.candidateId, candidates.id))
      .innerJoin(jobs, eq(submissions.jobId, jobs.id))
      .leftJoin(clientPackets, eq(submissions.packetId, clientPackets.id))
      .where(eq(submissions.id, submissionId))
  )[0];
  if (!row) notFound();

  const u = (await db.select().from(users).where(eq(users.id, Number(user.id))))[0];
  if (user.role === "client" && (!u || u.clientAccountId !== row.job.clientAccountId)) {
    redirect("/portal/client");
  }

  const [feedback, internalNotes] = await Promise.all([
    db
      .select()
      .from(feedbackEvents)
      .where(eq(feedbackEvents.submissionId, submissionId))
      .orderBy(desc(feedbackEvents.createdAt)),
    db
      .select()
      .from(commentsTable)
      .where(and(eq(commentsTable.targetType, "submission"), eq(commentsTable.targetId, submissionId)))
      .orderBy(desc(commentsTable.createdAt)),
  ]);

  const c = row.cand;
  const j = row.job;

  return (
    <main className="min-h-screen bg-canvas">
      <header className="bg-surface border-b border-hairline">
        <div className="max-w-4xl mx-auto px-4 md:px-8 h-14 flex items-center justify-between">
          <Link href="/portal/client" className="text-sm font-semibold">← {APP_NAME} · Client Portal</Link>
          <form action={async () => { "use server"; await signOut({ redirectTo: "/login" }); }}>
            <button type="submit" className="text-xs text-ink-soft hover:text-ink">Sign out</button>
          </form>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 md:px-8 py-6 md:py-8">
        <PageHeader
          title={c.fullName}
          subtitle={
            <span className="flex items-center gap-2">
              <span className="font-mono text-xs text-ink-muted">{c.refId}</span>
              <Badge tone="blue">{row.sub.status}</Badge>
              <span className="text-xs text-ink-soft">for {j.title}</span>
            </span>
          }
          actions={
            <form action={toggleStarAction.bind(null, submissionId)}>
              <button
                type="submit"
                className={`btn-ghost text-sm ${c.starredByClient ? "!bg-amber-50 !text-amber-700 !border-amber-100" : ""}`}
                aria-label={c.starredByClient ? "Unstar candidate" : "Star candidate"}
              >
                {c.starredByClient ? "★ Starred" : "☆ Star"}
              </button>
            </form>
          }
        />

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <StatCard label="Experience" value={c.experienceYears ? `${c.experienceYears} yrs` : "—"} />
          <StatCard label="Notice" value={c.noticePeriodDays ? `${c.noticePeriodDays}d` : "—"} />
          <StatCard label="Current CTC" value={fmt(c.currentCtc)} />
          <StatCard label="Expected CTC" value={fmt(c.expectedCtc)} />
        </div>

        <section className="card p-4 mb-4">
          <h2 className="text-sm font-semibold mb-3">Snapshot</h2>
          <Field label="Title">{c.currentTitle || "—"}</Field>
          <Field label="Location">{c.location || "—"}</Field>
          {c.summary && (
            <div className="pt-3 border-t border-hairline mt-3">
              <div className="text-xs text-ink-muted uppercase tracking-wide mb-1">Summary</div>
              <p className="text-sm leading-relaxed">{c.summary}</p>
            </div>
          )}
          {c.skills && c.skills.length > 0 && (
            <div className="pt-3 border-t border-hairline mt-3">
              <div className="text-xs text-ink-muted uppercase tracking-wide mb-2">Skills</div>
              <div className="flex flex-wrap gap-1.5">
                {c.skills.map((s) => <Badge key={s} tone="blue">{s}</Badge>)}
              </div>
            </div>
          )}
        </section>

        {row.packet && (
          <section className="card p-4 mb-4">
            <h2 className="text-sm font-semibold mb-2">Client packet</h2>
            <a href={row.packet.blobUrl} target="_blank" rel="noopener noreferrer" className="btn-ghost text-xs">
              Download sanitized PDF
            </a>
          </section>
        )}

        <section className="card p-4 mb-4">
          <h2 className="text-sm font-semibold mb-3">Your feedback</h2>
          <form action={clientFeedbackAction.bind(null, submissionId)} className="flex flex-wrap gap-1.5 mb-3">
            {(["shortlist", "interview", "hold", "reject"] as const).map((kind) => (
              <button
                key={kind}
                type="submit"
                name="kind"
                value={kind}
                className={`text-xs px-3 h-8 rounded-md border transition-colors ${
                  kind === "reject"
                    ? "border-red-200 text-red-700 hover:bg-red-50"
                    : kind === "shortlist"
                    ? "border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                    : "border-hairline text-ink hover:bg-canvas"
                }`}
              >
                {kind}
              </button>
            ))}
          </form>
          <form action={clientFeedbackAction.bind(null, submissionId)} className="space-y-2">
            <input type="hidden" name="kind" value="note" />
            <textarea name="body" rows={3} placeholder="Add a note for the recruiter…" className="input py-2 text-sm" />
            <button type="submit" className="btn-ghost text-xs">Send note</button>
          </form>
        </section>

        <section className="card p-4 mb-4 bg-amber-50/30 border-amber-100">
          <h2 className="text-sm font-semibold mb-1 text-amber-900">Internal notes (your team only)</h2>
          <p className="text-[11px] text-amber-700 mb-3">{APP_NAME} HR can&apos;t see these. Use for internal back-and-forth.</p>

          <form action={addClientInternalCommentAction.bind(null, submissionId)} className="space-y-2 mb-3">
            <textarea name="body" rows={2} placeholder="Note for your team…" className="input py-2 text-sm bg-white" />
            <button type="submit" className="btn-ghost text-xs">Add internal note</button>
          </form>

          {internalNotes.length === 0 ? (
            <div className="text-xs text-amber-800/70">No internal notes yet.</div>
          ) : (
            <ul className="text-sm divide-y divide-amber-100 -mx-1">
              {internalNotes.map((n) => (
                <li key={n.id} className="px-1 py-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium">{n.authorEmail || "—"}</span>
                    <span className="text-xs text-amber-700">{new Date(n.createdAt).toLocaleString()}</span>
                  </div>
                  <p className="text-sm mt-0.5 whitespace-pre-line">{n.body.replace(/^\[client-internal\]\s*/, "")}</p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card p-4">
          <h2 className="text-sm font-semibold mb-3">Feedback timeline</h2>
          {feedback.length === 0 ? (
            <div className="text-sm text-ink-soft">No feedback yet.</div>
          ) : (
            <ul className="text-sm divide-y divide-hairline -mx-1">
              {feedback.map((f) => (
                <li key={f.id} className="px-1 py-2">
                  <div className="flex items-center gap-2">
                    <Badge tone={f.kind === "reject" ? "red" : f.kind === "shortlist" || f.kind === "offer" || f.kind === "joined" ? "green" : f.kind === "hold" ? "amber" : "blue"}>
                      {f.kind}
                    </Badge>
                    <span className="text-xs text-ink-muted">{new Date(f.createdAt).toLocaleString()}</span>
                  </div>
                  {f.body && <p className="text-sm mt-1 text-ink-soft whitespace-pre-line">{f.body}</p>}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
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

function fmt(v: string | null) {
  if (!v) return "—";
  const n = Number(v);
  if (Number.isNaN(n)) return v;
  return n.toLocaleString("en-IN");
}
