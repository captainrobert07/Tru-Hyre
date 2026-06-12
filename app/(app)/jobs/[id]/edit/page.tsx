import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { clientAccounts, vendorAccounts, jobs, jobVendors } from "@/db/schema";
import { requireStaff } from "@/lib/rbac";
import { getFeatureStates } from "@/lib/features";
import { PageHeader } from "@/components/primitives";
import { JobForm } from "../../job-form";
import { JobAiButtons } from "@/components/job-ai-buttons";
import { updateJobAction } from "../../actions";
import { generateJobDescriptionAction, generateScreeningQuestionsAction } from "../../ai-actions";

export const metadata = { title: "Edit job" };

export default async function EditJobPage({ params }: { params: Promise<{ id: string }> }) {
  await requireStaff();
  const { id } = await params;
  const jobId = Number(id);
  const j = (await db.select().from(jobs).where(eq(jobs.id, jobId)))[0];
  if (!j) notFound();

  const [clients, vendors, vendorRows, flags] = await Promise.all([
    db.select({ id: clientAccounts.id, name: clientAccounts.name }).from(clientAccounts).orderBy(clientAccounts.name),
    db.select({ id: vendorAccounts.id, name: vendorAccounts.name }).from(vendorAccounts).orderBy(vendorAccounts.name),
    db.select({ vendorAccountId: jobVendors.vendorAccountId }).from(jobVendors).where(eq(jobVendors.jobId, jobId)),
    getFeatureStates(),
  ]);

  return (
    <>
      <PageHeader title={`Edit ${j.title}`} />
      <JobForm
        action={updateJobAction.bind(null, jobId)}
        clients={clients}
        vendors={vendors}
        aiButtons={
          <JobAiButtons
            jdEnabled={flags.ai_jd}
            screeningEnabled={flags.ai_screening}
            onGenerateJd={generateJobDescriptionAction}
            onGenerateScreening={generateScreeningQuestionsAction}
          />
        }
        initial={{
          title: j.title,
          clientAccountId: j.clientAccountId,
          status: j.status,
          priority: j.priority,
          location: j.location,
          workMode: j.workMode,
          experienceMin: j.experienceMin,
          experienceMax: j.experienceMax,
          ctcMin: j.ctcMin,
          ctcMax: j.ctcMax,
          positions: j.positions,
          description: j.description,
          skills: j.skills,
          closeBy: j.closeBy,
          vendorIds: vendorRows.map((r) => r.vendorAccountId),
        }}
      />
    </>
  );
}
