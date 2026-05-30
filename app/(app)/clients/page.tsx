import { requireStaff } from "@/lib/rbac";
import { PageHeader, EmptyState } from "@/components/primitives";

export default async function ClientsPage() {
  await requireStaff();
  return (
    <>
      <PageHeader title="Clients" subtitle="Coming in Phase 3b" />
      <EmptyState title="Client management ships in Phase 3b" />
    </>
  );
}
