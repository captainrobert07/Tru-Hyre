import { requireStaff } from "@/lib/rbac";
import { PageHeader, EmptyState } from "@/components/primitives";

export default async function ReportsPage() {
  await requireStaff();
  return (
    <>
      <PageHeader title="Reports" subtitle="Coming in Phase 3c" />
      <EmptyState title="Reports dashboard ships in Phase 3c" />
    </>
  );
}
