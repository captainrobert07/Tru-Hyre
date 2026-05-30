import { requireStaff } from "@/lib/rbac";
import { PageHeader, EmptyState } from "@/components/primitives";

export default async function VendorsPage() {
  await requireStaff();
  return (
    <>
      <PageHeader title="Vendors" subtitle="Coming in Phase 3b" />
      <EmptyState title="Vendor management ships in Phase 3b" />
    </>
  );
}
