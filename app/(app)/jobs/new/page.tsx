import { db } from "@/db";
import { clientAccounts, vendorAccounts } from "@/db/schema";
import { requireStaff } from "@/lib/rbac";
import { PageHeader } from "@/components/primitives";
import { JobForm } from "../job-form";
import { createJobAction } from "../actions";

export const metadata = { title: "New job" };

export default async function NewJobPage() {
  await requireStaff();
  const [clients, vendors] = await Promise.all([
    db.select({ id: clientAccounts.id, name: clientAccounts.name }).from(clientAccounts).orderBy(clientAccounts.name),
    db.select({ id: vendorAccounts.id, name: vendorAccounts.name }).from(vendorAccounts).orderBy(vendorAccounts.name),
  ]);
  return (
    <>
      <PageHeader title="New job" subtitle="Define a role and assign vendors who can submit candidates." />
      <JobForm action={createJobAction} clients={clients} vendors={vendors} />
    </>
  );
}
