import { requireUser } from "@/lib/rbac";
import { PageHeader, EmptyState } from "@/components/primitives";

export default async function NotificationsPage() {
  await requireUser();
  return (
    <>
      <PageHeader title="Notifications" subtitle="Coming in Phase 3c" />
      <EmptyState title="Notifications inbox ships in Phase 3c" />
    </>
  );
}
