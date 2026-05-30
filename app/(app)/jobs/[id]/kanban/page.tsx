import Link from "next/link";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { jobs, submissions, candidates, clientAccounts } from "@/db/schema";
import { requireStaff } from "@/lib/rbac";
import { PageHeader } from "@/components/primitives";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { Board, type Card } from "./board";

export const dynamic = "force-dynamic";
export const metadata = { title: "Job pipeline" };

export default async function JobKanban({ params }: { params: Promise<{ id: string }> }) {
  await requireStaff();
  const { id } = await params;
  const jobId = Number(id);
  if (!Number.isFinite(jobId)) notFound();

  const j = (
    await db
      .select({ id: jobs.id, title: jobs.title, clientName: clientAccounts.name })
      .from(jobs)
      .leftJoin(clientAccounts, eq(jobs.clientAccountId, clientAccounts.id))
      .where(eq(jobs.id, jobId))
  )[0];
  if (!j) notFound();

  const subs = await db
    .select({
      id: submissions.id,
      candidateId: submissions.candidateId,
      candidateName: candidates.fullName,
      candidateRefId: candidates.refId,
      candidateTitle: candidates.currentTitle,
      candidateExperience: candidates.experienceYears,
      starred: candidates.starredByClient,
      status: submissions.status,
      createdAt: submissions.createdAt,
    })
    .from(submissions)
    .innerJoin(candidates, eq(submissions.candidateId, candidates.id))
    .where(eq(submissions.jobId, jobId))
    .orderBy(submissions.createdAt);

  const cards: Card[] = subs.map((s) => ({
    id: s.id,
    candidateId: s.candidateId,
    candidateName: s.candidateName,
    candidateRefId: s.candidateRefId,
    candidateTitle: s.candidateTitle,
    candidateExperience: s.candidateExperience,
    starred: s.starred,
    status: s.status,
    createdAt: s.createdAt.toISOString(),
  }));

  return (
    <>
      <Breadcrumbs
        crumbs={[
          { href: "/dashboard", label: "Dashboard" },
          { href: "/jobs", label: "Jobs" },
          { href: `/jobs/${jobId}`, label: j.title },
          { label: "Pipeline" },
        ]}
      />

      <PageHeader
        title={j.title}
        subtitle={`${j.clientName} · ${subs.length} submissions · drag to move`}
        actions={
          <Link href={`/jobs/${jobId}`} className="btn-ghost">Back to job</Link>
        }
      />

      <Board initialCards={cards} />

      <p className="text-[11px] text-ink-muted text-center pt-2">
        Drag a card to a column to move it. Updates land instantly; the candidate&apos;s stage syncs automatically.
      </p>
    </>
  );
}
