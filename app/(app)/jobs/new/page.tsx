import { requireStaff } from "@/lib/rbac";
import { PageHeader, EmptyState } from "@/components/primitives";

export default async function NewJobPage() {
  await requireStaff();
  return (
    <>
      <PageHeader title="New job" subtitle="Coming in Phase 3b" />
      <EmptyState title="Job creation form ships in Phase 3b" cta={{ href: "/jobs", label: "Back to jobs" }} />
    </>
  );
}
