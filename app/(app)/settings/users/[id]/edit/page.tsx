import { eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { users } from "@/db/schema";
import { requireAdmin } from "@/lib/rbac";
import { isFeatureEnabled } from "@/lib/features";
import { PageHeader } from "@/components/primitives";
import { UserForm } from "../../user-form";
import { updateUserAction, listAccountOptions } from "../../../actions";

export const metadata = { title: "Edit user" };

export default async function EditUserPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const userId = Number(id);
  const u = (await db.select().from(users).where(eq(users.id, userId)))[0];
  if (!u) notFound();
  const { clients, vendors } = await listAccountOptions();
  const showPermissions = (await isFeatureEnabled("granular_permissions")) && (u.role === "hr" || u.role === "hr_lite");
  return (
    <>
      <PageHeader title={`Edit ${u.fullName}`} subtitle={u.email} />
      <UserForm
        action={updateUserAction.bind(null, userId)}
        clients={clients}
        vendors={vendors}
        initial={u}
        isCreate={false}
      />
      {showPermissions && (
        <Link href={`/settings/users/${userId}/permissions`} className="btn-ghost mt-4 inline-block">Manage permissions →</Link>
      )}
    </>
  );
}
