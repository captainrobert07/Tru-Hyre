import { requireAdmin } from "@/lib/rbac";
import { PageHeader } from "@/components/primitives";
import { UserForm } from "../user-form";
import { createUserAction, listAccountOptions } from "../../actions";

export const metadata = { title: "New user" };

export default async function NewUserPage() {
  await requireAdmin();
  const { clients, vendors } = await listAccountOptions();
  return (
    <>
      <PageHeader title="New user" />
      <UserForm action={createUserAction} clients={clients} vendors={vendors} isCreate />
    </>
  );
}
