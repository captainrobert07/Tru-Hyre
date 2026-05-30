import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { clientAccounts } from "@/db/schema";
import { requireStaff } from "@/lib/rbac";
import { PageHeader } from "@/components/primitives";
import { ClientForm } from "../../client-form";
import { updateClientAction } from "../../actions";

export const metadata = { title: "Edit client" };

export default async function EditClientPage({ params }: { params: Promise<{ id: string }> }) {
  await requireStaff();
  const { id } = await params;
  const clientId = Number(id);
  const c = (await db.select().from(clientAccounts).where(eq(clientAccounts.id, clientId)))[0];
  if (!c) notFound();
  return (
    <>
      <PageHeader title={`Edit ${c.name}`} />
      <ClientForm action={updateClientAction.bind(null, clientId)} initial={c} />
    </>
  );
}
