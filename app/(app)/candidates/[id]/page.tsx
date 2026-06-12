import { notFound } from "next/navigation";
import Link from "next/link";
import { eq, desc, inArray, and } from "drizzle-orm";
import { db } from "@/db";
import { candidates, resumeFiles, clientPackets, stageHistory, jobs, submissions, feedbackEvents, comments, interviews, users, emailOutbox, emailTemplates, interviewFeedback, offers } from "@/db/schema";
import { requireStaff } from "@/lib/rbac";
import { getFeatureStates } from "@/lib/features";
import { PageHeader, StageBadge, Badge, StatCard } from "@/components/primitives";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { RecentTracker } from "@/components/recently-viewed";
import { SubmitButton } from "@/components/submit-button";
import { PendingShimmer } from "@/components/pending-shimmer";
import { TimeAgo } from "@/components/time-ago";
import { StageButtons } from "@/components/stage-buttons";
import { InterviewScheduler, type InterviewItem } from "@/components/interview-scheduler";
import { EmailComposer, type OutboxItem } from "@/components/email-composer";
import { Scorecard, type ScorecardItem } from "@/components/scorecard";
import { AiSummaryButton } from "@/components/ai-summary-button";
import { OffersPanel, type OfferItem } from "@/components/offers-panel";
import { setStageAction, generatePacketAction, submitToJobAction, deleteCandidateAction, updateCandidateFieldAction } from "./actions";
import { createOfferAction, setOfferStatusAction } from "./offer-actions";
import { scheduleInterviewAction, cancelInterviewAction } from "./interview-actions";
import { sendAdHocEmailAction } from "./email-actions";
import { submitScorecardAction } from "./scorecard-actions";
import { generateCandidateSummaryAction } from "./ai-actions";
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

  const flags = await getFeatureStates();

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
  const [feedback, candComments, candInterviews, staff, outboxRows, activeTemplates, scorecardRows, offerRows] = await Promise.all([
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
    db
      .select()
      .from(interviews)
      .where(eq(interviews.candidateId, candidateId))
      .orderBy(desc(interviews.scheduledStart)),
    db
      .select({ id: users.id, fullName: users.fullName, email: users.email })
      .from(users)
      .where(and(inArray(users.role, ["admin", "hr"]), eq(users.isActive, true)))
      .orderBy(users.fullName)
      .limit(50),
    db
      .select({
        id: emailOutbox.id,
        templateSlug: emailOutbox.templateSlug,
        subject: emailOutbox.subject,
        toEmail: emailOutbox.toEmail,
        status: emailOutbox.status,
        error: emailOutbox.error,
        sentAt: emailOutbox.sentAt,
        createdAt: emailOutbox.createdAt,
      })
      .from(emailOutbox)
      .where(eq(emailOutbox.candidateId, candidateId))
      .orderBy(desc(emailOutbox.createdAt))
      .limit(30),
    db
      .select({ slug: emailTemplates.slug, name: emailTemplates.name })
      .from(emailTemplates)
      .where(eq(emailTemplates.isActive, true))
      .orderBy(emailTemplates.name),
    db
      .select({
        id: interviewFeedback.id,
        verdict: interviewFeedback.verdict,
        scores: interviewFeedback.scores,
        body: interviewFeedback.body,
        createdAt: interviewFeedback.createdAt,
        reviewerName: users.fullName,
        reviewerEmail: users.email,
      })
      .from(interviewFeedback)
      .leftJoin(users, eq(interviewFeedback.reviewerId, users.id))
      .where(eq(interviewFeedback.candidateId, candidateId))
      .orderBy(desc(interviewFeedback.createdAt)),
    db
      .select()
      .from(offers)
      .where(eq(offers.candidateId, candidateId))
      .orderBy(desc(offers.createdAt)),
  ]);

  const offerItems: OfferItem[] = offerRows.map((o) => ({
    id: o.id,
    title: o.title,
    ctc: o.ctc,
    currency: o.currency,
    joiningDate: o.joiningDate,
    expiresOn: o.expiresOn,
    status: o.status,
    notes: o.notes,
  }));

  const scorecardItems: ScorecardItem[] = scorecardRows.map((s) => ({
    id: s.id,
    verdict: s.verdict,
    scores: s.scores || {},
    body: s.body,
    reviewerName: s.reviewerName || s.reviewerEmail || "Unknown",
    createdAt: s.createdAt.toISOString(),
  }));

  const outboxItems: OutboxItem[] = outboxRows.map((m) => ({
    id: m.id,
    templateSlug: m.templateSlug,
    subject: m.subject,
    toEmail: m.toEmail,
    status: m.status,
    error: m.error,
    sentAt: m.sentAt ? m.sentAt.toISOString() : null,
    createdAt: m.createdAt.toISOString(),
  }));

  // Build interviewer-name lookup for the interview list.
  const staffById = new Map(staff.map((s) => [s.id, s.fullName || s.email]));
  const interviewItems: InterviewItem[] = candInterviews.map((iv) => ({
    id: iv.id,
    title: iv.title,
    mode: iv.mode,
    scheduledStart: iv.scheduledStart.toISOString(),
    scheduledEnd: iv.scheduledEnd.toISOString(),
    location: iv.location,
    meetLink: iv.meetLink,
    status: iv.status,
    interviewerNames: (iv.interviewerIds || []).map((id) => staffById.get(id)).filter((n): n is string => Boolean(n)),
  }));

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
      <RecentTracker kind="candidate" label={cand.fullName} />
      <Breadcrumbs
        crumbs={[
          { href: "/dashboard", label: "Dashboard" },
          { href: "/candidates", label: "Candidates" },
          { label: cand.fullName },
        ]}
      />
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
        <EditableStat
          label="Experience"
          field="experienceYears"
          value={cand.experienceYears ? `${cand.experienceYears} yrs` : "—"}
          rawValue={cand.experienceYears || ""}
          placeholder="e.g. 7"
          candidateId={candidateId}
        />
        <EditableStat
          label="Notice"
          field="noticePeriodDays"
          value={cand.noticePeriodDays !== null ? `${cand.noticePeriodDays}d` : "—"}
          rawValue={cand.noticePeriodDays?.toString() || ""}
          placeholder="days"
          candidateId={candidateId}
        />
        <EditableStat
          label="Current CTC"
          field="currentCtc"
          value={fmtMoney(cand.currentCtc)}
          rawValue={cand.currentCtc || ""}
          placeholder="e.g. 18L or 1800000"
          candidateId={candidateId}
        />
        <EditableStat
          label="Expected CTC"
          field="expectedCtc"
          value={fmtMoney(cand.expectedCtc)}
          rawValue={cand.expectedCtc || ""}
          placeholder="e.g. 25L or 2500000"
          candidateId={candidateId}
        />
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
              <div className="flex items-center justify-between mb-1">
                <div className="text-xs text-ink-muted uppercase tracking-wide">Summary</div>
                {flags.ai_summary && (
                  <AiSummaryButton
                    onGenerate={async () => {
                      "use server";
                      return await generateCandidateSummaryAction(candidateId);
                    }}
                  />
                )}
              </div>
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

          <Section title="Career details">
            <Field label="LinkedIn">
              <InlineEdit
                field="linkedinUrl"
                defaultValue={cand.linkedinUrl || ""}
                placeholder="https://linkedin.com/in/…"
                onSave={async (fd) => {
                  "use server";
                  await updateCandidateFieldAction(candidateId, fd);
                }}
              />
            </Field>
            <Field label="GitHub">
              <InlineEdit
                field="githubUrl"
                defaultValue={cand.githubUrl || ""}
                placeholder="https://github.com/…"
                onSave={async (fd) => {
                  "use server";
                  await updateCandidateFieldAction(candidateId, fd);
                }}
              />
            </Field>
            <Field label="Available from">
              <InlineEdit
                field="availableFrom"
                defaultValue={cand.availableFrom || ""}
                placeholder="YYYY-MM-DD"
                onSave={async (fd) => {
                  "use server";
                  await updateCandidateFieldAction(candidateId, fd);
                }}
              />
            </Field>
            <Field label="Willing to relocate">
              <InlineEdit
                field="willingToRelocate"
                defaultValue={cand.willingToRelocate === null || cand.willingToRelocate === undefined ? "" : (cand.willingToRelocate ? "yes" : "no")}
                placeholder="yes / no"
                onSave={async (fd) => {
                  "use server";
                  await updateCandidateFieldAction(candidateId, fd);
                }}
              />
            </Field>
            <Field label="Work authorization">
              <InlineEdit
                field="workAuthorization"
                defaultValue={cand.workAuthorization || ""}
                placeholder="e.g. EU citizen, H-1B, PR"
                onSave={async (fd) => {
                  "use server";
                  await updateCandidateFieldAction(candidateId, fd);
                }}
              />
            </Field>
            {flags.source_tracking && (
              <>
                <Field label="Source">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge tone="blue">{(cand.source || "direct").replaceAll("_", " ")}</Badge>
                    <InlineEdit
                      field="source"
                      defaultValue={cand.source || "direct"}
                      placeholder="direct / referral / linkedin / job_board / agency / careers / other"
                      onSave={async (fd) => {
                        "use server";
                        await updateCandidateFieldAction(candidateId, fd);
                      }}
                    />
                  </div>
                </Field>
                <Field label="Source detail">
                  <InlineEdit
                    field="sourceDetail"
                    defaultValue={cand.sourceDetail || ""}
                    placeholder="Referrer name, board, etc."
                    onSave={async (fd) => {
                      "use server";
                      await updateCandidateFieldAction(candidateId, fd);
                    }}
                  />
                </Field>
              </>
            )}
            <Field label="Tags">
              <div>
                {cand.tags && cand.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-1">
                    {cand.tags.map((t) => <Badge key={t} tone="default">{t}</Badge>)}
                  </div>
                )}
                <InlineEdit
                  field="tagsCsv"
                  defaultValue={(cand.tags || []).join(", ")}
                  placeholder="reapplicant, internal, urgent"
                  onSave={async (fd) => {
                    "use server";
                    await updateCandidateFieldAction(candidateId, fd);
                  }}
                />
              </div>
            </Field>
          </Section>

          <Section title="Internal notes">
            <p className="text-[11px] text-ink-muted mb-2">Visible to HR/admin only. Never shown to clients or vendors.</p>
            <InlineEdit
              field="notes"
              defaultValue={cand.notes || ""}
              multiline
              placeholder="Type a quick scratch note…"
              onSave={async (fd) => {
                "use server";
                await updateCandidateFieldAction(candidateId, fd);
              }}
            />
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
                        <div className="text-[10px] text-ink-muted mt-1"><TimeAgo date={a.at} /></div>
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
                        <div className="text-[10px] text-ink-muted mt-1"><TimeAgo date={a.at} /></div>
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
                return await setStageAction(candidateId, stage);
              }}
            />
          </Section>

          {flags.interviews && (
          <Section title="Interviews">
            <InterviewScheduler
              interviews={interviewItems}
              interviewers={staff.map((s) => ({ id: s.id, name: s.fullName || s.email }))}
              submissions={subs.map((s) => ({ id: s.id, jobId: s.jobId, label: `Job #${s.jobId} · ${s.status}` }))}
              onSchedule={async (fd) => {
                "use server";
                return await scheduleInterviewAction(candidateId, fd);
              }}
              onCancel={async (interviewId) => {
                "use server";
                return await cancelInterviewAction(candidateId, interviewId);
              }}
            />
          </Section>
          )}

          {flags.email_composer && (
          <Section title="Communication">
            <EmailComposer
              candidateEmail={cand.email}
              outbox={outboxItems}
              templates={activeTemplates}
              onSend={async (fd) => {
                "use server";
                return await sendAdHocEmailAction(candidateId, fd);
              }}
            />
          </Section>
          )}

          {flags.scorecards && (
          <Section title="Scorecards">
            <Scorecard
              scorecards={scorecardItems}
              submissions={subs.map((s) => ({ id: s.id, jobId: s.jobId, label: `Job #${s.jobId} · ${s.status}` }))}
              interviews={interviewItems.map((i) => ({ id: i.id, label: `${i.title} · ${new Date(i.scheduledStart).toLocaleDateString()}` }))}
              onSubmit={async (fd) => {
                "use server";
                return await submitScorecardAction(candidateId, fd);
              }}
            />
          </Section>
          )}

          {flags.offers && (
          <Section title="Offers">
            <OffersPanel
              offers={offerItems}
              onCreate={async (fd) => {
                "use server";
                return await createOfferAction(candidateId, fd);
              }}
              onSetStatus={async (offerId, status) => {
                "use server";
                return await setOfferStatusAction(candidateId, offerId, status);
              }}
            />
          </Section>
          )}

          <Section title="Resume">
            {latestResume ? (
              <div className="text-sm space-y-3">
                <div className="flex items-center gap-2 text-ink-soft text-xs">
                  <span className="truncate flex-1">{latestResume.originalName}</span>
                  <a href={`/api/files/${latestResume.driveFileId}`} target="_blank" rel="noopener noreferrer" className="text-brand-700 hover:underline shrink-0">
                    Open in new tab ↗
                  </a>
                </div>
                <div className="rounded-lg overflow-hidden border border-hairline bg-canvas">
                  <object
                    data={`/api/files/${latestResume.driveFileId}#toolbar=0&navpanes=0&scrollbar=0`}
                    type="application/pdf"
                    className="w-full h-[420px]"
                    aria-label={`Resume preview for ${cand.fullName}`}
                  >
                    <div className="p-6 text-center text-sm text-ink-soft">
                      Your browser can&apos;t display PDFs inline.{" "}
                      <a href={`/api/files/${latestResume.driveFileId}`} target="_blank" rel="noopener noreferrer" className="text-brand-700 hover:underline">
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
              <PendingShimmer label="Rendering sanitized PDF…" />
              <p className="text-[11px] text-ink-muted">
                Excludes email, phone, vendor name, and internal notes — safe to share with the client.
              </p>
            </form>
            {latestPacket && (
              <a href={`/api/files/${latestPacket.driveFileId}`} target="_blank" rel="noopener noreferrer" className="btn-ghost text-xs w-full mt-2 block text-center">
                Download latest
              </a>
            )}
          </Section>

          <Section title="Reminder">
            <form
              action={async (fd) => {
                "use server";
                fd.set("candidateId", String(candidateId));
                const mod = await import("@/app/(app)/tasks/actions");
                await mod.createTaskAction(fd);
              }}
              className="space-y-2"
            >
              <input name="title" placeholder="e.g. Follow up next Tuesday" required className="input text-sm" />
              <input name="dueAt" type="date" className="input text-sm" />
              <button type="submit" className="btn-ghost text-xs w-full">Add reminder</button>
            </form>
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
  if (n >= 10_000_000) return `${(n / 10_000_000).toFixed(1)}cr`;
  if (n >= 100_000) return `${(n / 100_000).toFixed(1)}L`;
  return n.toLocaleString("en-IN");
}

function EditableStat({
  label,
  field,
  value,
  rawValue,
  placeholder,
  candidateId,
}: {
  label: string;
  field: string;
  value: string;
  rawValue: string;
  placeholder?: string;
  candidateId: number;
}) {
  return (
    <div className="card p-5 group">
      <div className="text-xs text-ink-muted uppercase tracking-wide mb-1">{label}</div>
      <div className="text-2xl font-semibold tabular-nums text-ink">{value}</div>
      <div className="mt-1.5 text-xs">
        <InlineEdit
          field={field}
          defaultValue={rawValue}
          placeholder={placeholder || "Edit"}
          onSave={async (fd) => {
            "use server";
            await updateCandidateFieldAction(candidateId, fd);
          }}
        />
      </div>
    </div>
  );
}
