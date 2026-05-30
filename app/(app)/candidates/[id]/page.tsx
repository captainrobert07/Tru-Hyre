import { notFound } from "next/navigation";
import Link from "next/link";
import { eq, desc } from "drizzle-orm";
import { db } from "@/db";
import { candidates, resumeFiles, clientPackets, stageHistory, jobs, submissions } from "@/db/schema";
import { requireStaff } from "@/lib/rbac";
import { PageHeader, StageBadge, Badge, StatCard } from "@/components/primitives";
import { SubmitButton } from "@/components/submit-button";
import { StageButtons } from "@/components/stage-buttons";
import { setStageAction, generatePacketAction, submitToJobAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function CandidateDetail({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireStaff();
  const { id } = await params;
  const candidateId = Number(id);
  if (!Number.isFinite(candidateId)) notFound();

  const cand = (await db.select().from(candidates).where(eq(candidates.id, candidateId)))[0];
  if (!cand) notFound();

  const [resume, packets, history, openJobs, subs] = await Promise.all([
    db
      .select()
      .from(resumeFiles)
      .where(eq(resumeFiles.candidateId, candidateId))
      .orderBy(desc(resumeFiles.uploadedAt))
      .limit(1),
    db
      .select()
      .from(clientPackets)
      .where(eq(clientPackets.candidateId, candidateId))
      .orderBy(desc(clientPackets.generatedAt)),
    db
      .select()
      .from(stageHistory)
      .where(eq(stageHistory.candidateId, candidateId))
      .orderBy(desc(stageHistory.createdAt))
      .limit(20),
    db
      .select({ id: jobs.id, title: jobs.title })
      .from(jobs)
      .where(eq(jobs.status, "open"))
      .orderBy(desc(jobs.createdAt))
      .limit(50),
    db
      .select({ id: submissions.id, jobId: submissions.jobId, status: submissions.status, createdAt: submissions.createdAt })
      .from(submissions)
      .where(eq(submissions.candidateId, candidateId))
      .orderBy(desc(submissions.createdAt)),
  ]);

  const latestResume = resume[0];
  const latestPacket = packets[0];

  return (
    <>
      <PageHeader
        title={cand.fullName}
        subtitle={
          <span className="flex items-center gap-2">
            <span className="font-mono text-xs text-ink-muted">{cand.refId}</span>
            <StageBadge stage={cand.stage} />
            {cand.parseStatus === "failed" && <Badge tone="red">parse failed</Badge>}
          </span>
        }
        actions={
          <Link href={`/candidates/${cand.id}/edit`} className="btn-ghost">Edit</Link>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <StatCard label="Experience" value={cand.experienceYears ? `${cand.experienceYears} yrs` : "—"} />
        <StatCard label="Notice" value={cand.noticePeriodDays ? `${cand.noticePeriodDays}d` : "—"} />
        <StatCard label="Current CTC" value={fmtMoney(cand.currentCtc)} />
        <StatCard label="Expected CTC" value={fmtMoney(cand.expectedCtc)} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <Section title="Profile">
            <Field label="Email">{cand.email || "—"}</Field>
            <Field label="Phone">{cand.phone || "—"}</Field>
            <Field label="Location">{cand.location || "—"}</Field>
            <Field label="Current title">{cand.currentTitle || "—"}</Field>
            <Field label="Current company">{cand.currentCompany || "—"}</Field>
            {cand.summary && (
              <div className="pt-3 border-t border-hairline mt-3">
                <div className="text-xs text-ink-muted uppercase tracking-wide">Summary</div>
                <p className="text-sm mt-1 leading-relaxed">{cand.summary}</p>
              </div>
            )}
            {cand.skills && cand.skills.length > 0 && (
              <div className="pt-3 border-t border-hairline mt-3">
                <div className="text-xs text-ink-muted uppercase tracking-wide mb-2">Skills</div>
                <div className="flex flex-wrap gap-1.5">
                  {cand.skills.map((s) => <Badge key={s} tone="blue">{s}</Badge>)}
                </div>
              </div>
            )}
          </Section>

          <Section title="Submissions">
            {subs.length === 0 ? (
              <div className="text-sm text-ink-soft px-1 py-2">Not submitted yet.</div>
            ) : (
              <ul className="text-sm divide-y divide-hairline -mx-1">
                {subs.map((s) => (
                  <li key={s.id} className="px-1 py-2 flex justify-between">
                    <Link href={`/jobs/${s.jobId}`} className="text-brand-700 hover:underline">Job #{s.jobId}</Link>
                    <Badge tone="blue">{s.status}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title="Stage history">
            {history.length === 0 ? (
              <div className="text-sm text-ink-soft px-1 py-2">No transitions yet.</div>
            ) : (
              <ul className="text-sm divide-y divide-hairline -mx-1">
                {history.map((h) => (
                  <li key={h.id} className="px-1 py-2 flex items-center justify-between">
                    <span>
                      {h.fromStage ? `${h.fromStage} → ` : ""}{h.toStage}
                      {h.note && <span className="text-ink-soft"> · {h.note}</span>}
                    </span>
                    <span className="text-xs text-ink-muted">{new Date(h.createdAt).toLocaleString()}</span>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>

        <div className="space-y-4">
          <Section title="Move stage">
            <StageButtons
              current={cand.stage}
              setStage={async (stage) => {
                "use server";
                await setStageAction(candidateId, stage);
              }}
            />
          </Section>

          <Section title="Resume">
            {latestResume ? (
              <div className="text-sm space-y-2">
                <div className="text-ink-soft truncate">{latestResume.originalName}</div>
                <a href={latestResume.blobUrl} target="_blank" rel="noopener noreferrer" className="btn-ghost text-xs">
                  Download PDF
                </a>
              </div>
            ) : (
              <div className="text-sm text-ink-soft">Pasted text — no file stored.</div>
            )}
          </Section>

          <Section title="Client packet">
            <form
              action={async () => {
                "use server";
                await generatePacketAction(candidateId);
              }}
              className="space-y-2"
            >
              <SubmitButton className="text-xs w-full" pendingLabel="Generating…">
                {latestPacket ? "Regenerate packet" : "Generate packet"}
              </SubmitButton>
              <p className="text-[11px] text-ink-muted">
                Excludes email, phone, vendor name, and internal notes — safe to share with the client.
              </p>
            </form>
            {latestPacket && (
              <a href={latestPacket.blobUrl} target="_blank" rel="noopener noreferrer" className="btn-ghost text-xs w-full mt-2 block text-center">
                Download latest
              </a>
            )}
          </Section>

          <Section title="Submit to job">
            <form action={submitToJobAction.bind(null, candidateId)} className="space-y-2">
              <select name="jobId" className="input text-sm" required>
                <option value="">Select an open job…</option>
                {openJobs.map((j) => (
                  <option key={j.id} value={j.id}>{j.title}</option>
                ))}
              </select>
              <textarea name="notes" placeholder="Notes (optional)" rows={2} className="input text-sm py-2" />
              <SubmitButton
                className="text-xs w-full"
                disabled={!latestPacket}
                pendingLabel="Submitting…"
              >
                {latestPacket ? "Submit to job" : "Generate packet first"}
              </SubmitButton>
            </form>
          </Section>
        </div>
      </div>

      <div className="text-xs text-ink-muted mt-8">Viewing as {user.email}</div>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="card p-4">
      <h2 className="text-sm font-semibold mb-3">{title}</h2>
      {children}
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-3 gap-2 py-1.5 text-sm">
      <div className="text-ink-muted text-xs uppercase tracking-wide pt-0.5">{label}</div>
      <div className="col-span-2 text-ink">{children}</div>
    </div>
  );
}

function fmtMoney(v: string | null) {
  if (!v) return "—";
  const n = Number(v);
  if (Number.isNaN(n)) return v;
  return n.toLocaleString("en-IN");
}
