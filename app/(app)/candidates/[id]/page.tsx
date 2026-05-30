import { notFound } from "next/navigation";
import Link from "next/link";
import { eq, desc, inArray, and } from "drizzle-orm";
import { db } from "@/db";
import { candidates, resumeFiles, clientPackets, stageHistory, jobs, submissions, feedbackEvents, comments } from "@/db/schema";
import { requireStaff } from "@/lib/rbac";
import { PageHeader, StageBadge, Badge, StatCard } from "@/components/primitives";
import { SubmitButton } from "@/components/submit-button";
import { StageButtons } from "@/components/stage-buttons";
import { setStageAction, generatePacketAction, submitToJobAction, deleteCandidateAction, updateCandidateFieldAction } from "./actions";
import { addCandidateCommentAction, deleteCandidateCommentAction } from "./comment-actions";
import { DangerZone } from "./danger-zone";
import { InlineEdit } from "@/components/inline-edit";
import { Comments } from "@/components/comments";

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

  // Fetch feedback for all submissions of this candidate, then weave a unified
  // activity timeline (stage moves + feedback events).
  const subIds = subs.map((s) => s.id);
  const [feedback, candComments] = await Promise.all([
    subIds.length === 0
      ? Promise.resolve([])
      : db
          .select({
            id: feedbackEvents.id,
            submissionId: feedbackEvents.submissionId,
            kind: feedbackEvents.kind,
            body: feedbackEvents.body,
            createdAt: feedbackEvents.createdAt,
          })
          .from(feedbackEvents)
          .where(inArray(feedbackEvents.submissionId, subIds))
          .orderBy(desc(feedbackEvents.createdAt)),
    db
      .select({
        id: comments.id,
        body: comments.body,
        authorEmail: comments.authorEmail,
        authorId: comments.authorId,
        createdAt: comments.createdAt,
      })
      .from(comments)
      .where(and(eq(comments.targetType, "candidate"), eq(comments.targetId, candidateId)))
      .orderBy(desc(comments.createdAt)),
  ]);

  type Activity =
    | { kind: "stage"; at: Date; from: string | null; to: string; note: string | null }
    | { kind: "feedback"; at: Date; feedbackKind: string; body: string | null; submissionId: number };

  const activity: Activity[] = [
    ...history.map((h): Activity => ({ kind: "stage", at: h.createdAt, from: h.fromStage, to: h.toStage, note: h.note })),
    ...feedback.map((f): Activity => ({ kind: "feedback", at: f.createdAt, feedbackKind: f.kind, body: f.body, submissionId: f.submissionId })),
  ].sort((a, b) => b.at.getTime() - a.at.getTime());

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
            <Field label="Email">
              <InlineEdit
                field="email"
                defaultValue={cand.email || ""}
                onSave={async (fd) => {
                  "use server";
                  await updateCandidateFieldAction(candidateId, fd);
                }}
              />
            </Field>
            <Field label="Phone">
              <InlineEdit
                field="phone"
                defaultValue={cand.phone || ""}
                onSave={async (fd) => {
                  "use server";
                  await updateCandidateFieldAction(candidateId, fd);
                }}
              />
            </Field>
            <Field label="Location">
              <InlineEdit
                field="location"
                defaultValue={cand.location || ""}
                onSave={async (fd) => {
                  "use server";
                  await updateCandidateFieldAction(candidateId, fd);
                }}
              />
            </Field>
            <Field label="Current title">
              <InlineEdit
                field="currentTitle"
                defaultValue={cand.currentTitle || ""}
                onSave={async (fd) => {
                  "use server";
                  await updateCandidateFieldAction(candidateId, fd);
                }}
              />
            </Field>
            <Field label="Current company">
              <InlineEdit
                field="currentCompany"
                defaultValue={cand.currentCompany || ""}
                onSave={async (fd) => {
                  "use server";
                  await updateCandidateFieldAction(candidateId, fd);
                }}
              />
            </Field>
            <div className="pt-3 border-t border-hairline mt-3">
              <div className="text-xs text-ink-muted uppercase tracking-wide mb-1">Summary</div>
              <InlineEdit
                field="summary"
                defaultValue={cand.summary || ""}
                multiline
                placeholder="Add a summary…"
                onSave={async (fd) => {
                  "use server";
                  await updateCandidateFieldAction(candidateId, fd);
                }}
              />
            </div>
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

          <Section title="Activity">
            {activity.length === 0 ? (
              <div className="text-sm text-ink-soft px-1 py-2">No activity yet.</div>
            ) : (
              <ol className="relative pl-5 space-y-3 before:absolute before:left-[7px] before:top-1.5 before:bottom-1.5 before:w-px before:bg-hairline">
                {activity.map((a, i) => (
                  <li key={i} className="relative">
                    <span
                      className={`absolute -left-5 top-1.5 size-3 rounded-full border-2 border-surface ${
                        a.kind === "stage" && a.to === "rejected"
                          ? "bg-red-500"
                          : a.kind === "feedback" && a.feedbackKind === "reject"
                          ? "bg-red-500"
                          : a.kind === "feedback" && (a.feedbackKind === "shortlist" || a.feedbackKind === "offer" || a.feedbackKind === "joined")
                          ? "bg-brand-500"
                          : a.kind === "feedback"
                          ? "bg-amber-500"
                          : "bg-blue-500"
                      }`}
                    />
                    {a.kind === "stage" ? (
                      <div className="text-sm">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium">Stage</span>
                          {a.from && <Badge tone="default">{a.from.replaceAll("_", " ")}</Badge>}
                          <span className="text-ink-muted">→</span>
                          <StageBadge stage={a.to} />
                        </div>
                        {a.note && <p className="text-xs text-ink-soft mt-1">{a.note}</p>}
                        <div className="text-[10px] text-ink-muted mt-1">{new Date(a.at).toLocaleString()}</div>
                      </div>
                    ) : (
                      <div className="text-sm">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium">Feedback</span>
                          <Badge tone={a.feedbackKind === "reject" ? "red" : a.feedbackKind === "shortlist" || a.feedbackKind === "offer" || a.feedbackKind === "joined" ? "green" : a.feedbackKind === "hold" ? "amber" : "blue"}>
                            {a.feedbackKind}
                          </Badge>
                          <Link href={`/jobs/${subs.find((s) => s.id === a.submissionId)?.jobId || ""}`} className="text-xs text-brand-700 hover:underline">
                            on submission #{a.submissionId}
                          </Link>
                        </div>
                        {a.body && <p className="text-xs text-ink-soft mt-1 whitespace-pre-line">{a.body}</p>}
                        <div className="text-[10px] text-ink-muted mt-1">{new Date(a.at).toLocaleString()}</div>
                      </div>
                    )}
                  </li>
                ))}
              </ol>
            )}
          </Section>

          <Comments
            comments={candComments.map((c) => ({
              id: c.id,
              body: c.body,
              authorEmail: c.authorEmail,
              authorId: c.authorId,
              createdAt: c.createdAt.toISOString(),
            }))}
            currentUserId={Number(user.id)}
            isAdmin={user.role === "admin"}
            onAdd={async (fd) => {
              "use server";
              await addCandidateCommentAction(candidateId, fd);
            }}
            onDelete={async (id) => {
              "use server";
              await deleteCandidateCommentAction(candidateId, id);
            }}
          />
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
              <div className="text-sm space-y-3">
                <div className="flex items-center gap-2 text-ink-soft text-xs">
                  <span className="truncate flex-1">{latestResume.originalName}</span>
                  <a href={latestResume.blobUrl} target="_blank" rel="noopener noreferrer" className="text-brand-700 hover:underline shrink-0">
                    Open in new tab ↗
                  </a>
                </div>
                <div className="rounded-lg overflow-hidden border border-hairline bg-canvas">
                  <object
                    data={`${latestResume.blobUrl}#toolbar=0&navpanes=0&scrollbar=0`}
                    type="application/pdf"
                    className="w-full h-[420px]"
                    aria-label={`Resume preview for ${cand.fullName}`}
                  >
                    <div className="p-6 text-center text-sm text-ink-soft">
                      Your browser can&apos;t display PDFs inline.{" "}
                      <a href={latestResume.blobUrl} target="_blank" rel="noopener noreferrer" className="text-brand-700 hover:underline">
                        Download instead.
                      </a>
                    </div>
                  </object>
                </div>
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

          <DangerZone
            candidateId={candidateId}
            candidateName={cand.fullName}
            exportHref={`/api/candidates/${candidateId}/export`}
            isAdmin={user.role === "admin"}
            onDelete={async () => {
              "use server";
              await deleteCandidateAction(candidateId);
            }}
          />
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
