import { requireStaff } from "@/lib/rbac";
import { PageHeader } from "@/components/primitives";
import { ClientForm } from "../client-form";
import { createClientAction } from "../actions";

export const metadata = { title: "New client" };

export default async function NewClientPage() {
  await requireStaff();
  return (
    <>
      <PageHeader title="New client" />
      <ClientForm action={createClientAction} />
    </>
  );
}
