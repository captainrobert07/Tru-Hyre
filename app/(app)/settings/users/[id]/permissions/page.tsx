import { eq } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import { db } from "@/db";
import { users, userPermissions } from "@/db/schema";
import { requireAdmin } from "@/lib/rbac";
import { isFeatureEnabled } from "@/lib/features";
import { PageHeader } from "@/components/primitives";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { PermissionsForm } from "./permissions-form";
import { setUserPermissionsAction } from "./permissions-actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "User permissions" };

export default async function UserPermissionsPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  if (!(await isFeatureEnabled("granular_permissions"))) redirect("/settings/users");
  const { id } = await params;
  const userId = Number(id);
  if (!Number.isFinite(userId)) notFound();

  const [u, permRow] = await Promise.all([
    db.select({ id: users.id, fullName: users.fullName, email: users.email, role: users.role }).from(users).where(eq(users.id, userId)).then((r) => r[0]),
    db.select({ permissions: userPermissions.permissions }).from(userPermissions).where(eq(userPermissions.userId, userId)).then((r) => r[0]),
  ]);
  if (!u) notFound();

  return (
    <>
      <Breadcrumbs crumbs={[{ href: "/dashboard", label: "Dashboard" }, { href: "/settings", label: "Settings" }, { href: "/settings/users", label: "Users" }, { label: "Permissions" }]} />
      <PageHeader
        title={`Permissions — ${u.fullName || u.email}`}
        subtitle={`Base role: ${u.role}. Grants below add capabilities on top of the base role (admins already have everything).`}
      />
      <PermissionsForm
        userId={userId}
        granted={permRow?.permissions || []}
        action={setUserPermissionsAction.bind(null, userId)}
      />
    </>
  );
}
