import { requireStaff } from "@/lib/rbac";
import { PageHeader, EmptyState } from "@/components/primitives";

export default async function EditJobPage() {
  await requireStaff();
  return (
    <>
      <PageHeader title="Edit job" subtitle="Coming in Phase 3b" />
      <EmptyState title="Job edit form ships in Phase 3b" />
    </>
  );
}
