import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { vendorAccounts } from "@/db/schema";
import { requireStaff } from "@/lib/rbac";
import { PageHeader } from "@/components/primitives";
import { VendorForm } from "../../vendor-form";
import { updateVendorAction } from "../../actions";

export const metadata = { title: "Edit vendor" };

export default async function EditVendorPage({ params }: { params: Promise<{ id: string }> }) {
  await requireStaff();
  const { id } = await params;
  const vendorId = Number(id);
  const v = (await db.select().from(vendorAccounts).where(eq(vendorAccounts.id, vendorId)))[0];
  if (!v) notFound();
  return (
    <>
      <PageHeader title={`Edit ${v.name}`} />
      <VendorForm action={updateVendorAction.bind(null, vendorId)} initial={v} />
    </>
  );
}
