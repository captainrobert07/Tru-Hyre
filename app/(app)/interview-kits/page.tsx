import { desc, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { interviewKits, jobs } from "@/db/schema";
import { requireStaff } from "@/lib/rbac";
import { isFeatureEnabled } from "@/lib/features";
import { PageHeader } from "@/components/primitives";
import { InterviewKitManager, type KitItem } from "@/components/interview-kit-manager";
import { saveInterviewKitAction, updateInterviewKitAction, deleteInterviewKitAction } from "./actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Interview kits" };

export default async function InterviewKitsPage() {
  await requireStaff();
  if (!(await isFeatureEnabled("interview_kits"))) redirect("/dashboard");

  const [kitRows, jobRows] = await Promise.all([
    db
      .select({
        id: interviewKits.id,
        name: interviewKits.name,
        jobId: interviewKits.jobId,
        jobTitle: jobs.title,
        focusAreas: interviewKits.focusAreas,
        questions: interviewKits.questions,
      })
      .from(interviewKits)
      .leftJoin(jobs, eq(interviewKits.jobId, jobs.id))
      .orderBy(desc(interviewKits.createdAt)),
    db.select({ id: jobs.id, title: jobs.title }).from(jobs).orderBy(jobs.title),
  ]);

  const kits: KitItem[] = kitRows.map((k) => ({
    id: k.id,
    name: k.name,
    jobId: k.jobId,
    jobTitle: k.jobTitle,
    focusAreas: k.focusAreas || [],
    questions: k.questions || [],
  }));

  return (
    <>
      <PageHeader
        title="Interview kits"
        subtitle="Reusable focus areas and question sets interviewers can pull up when running a round."
      />
      <InterviewKitManager
        kits={kits}
        jobs={jobRows}
        onCreate={async (fd) => {
          "use server";
          return await saveInterviewKitAction(fd);
        }}
        onUpdate={async (fd) => {
          "use server";
          return await updateInterviewKitAction(fd);
        }}
        onDelete={async (id) => {
          "use server";
          return await deleteInterviewKitAction(id);
        }}
      />
    </>
  );
}
