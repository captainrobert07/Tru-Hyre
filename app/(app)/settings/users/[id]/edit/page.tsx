import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { users } from "@/db/schema";
import { requireAdmin } from "@/lib/rbac";
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
    </>
  );
}
