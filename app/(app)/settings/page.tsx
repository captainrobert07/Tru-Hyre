import { requireAdmin } from "@/lib/rbac";
import { PageHeader, EmptyState } from "@/components/primitives";

export default async function SettingsPage() {
  await requireAdmin();
  return (
    <>
      <PageHeader title="Settings" subtitle="Coming in Phase 3c" />
      <EmptyState title="Settings (users, invitations, audit log) ships in Phase 3c" />
    </>
  );
}
