import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { vendorAccounts } from "@/db/schema";
import { requireStaff } from "@/lib/rbac";
import { isFeatureEnabled } from "@/lib/features";
import { PageHeader } from "@/components/primitives";
import { VendorForm } from "../../vendor-form";
import { updateVendorAction } from "../../actions";

export const metadata = { title: "Edit vendor" };

export default async function EditVendorPage({ params }: { params: Promise<{ id: string }> }) {
  await requireStaff();
  const { id } = await params;
  const vendorId = Number(id);
  const [v, showCommission] = await Promise.all([
    db.select().from(vendorAccounts).where(eq(vendorAccounts.id, vendorId)).then((r) => r[0]),
    isFeatureEnabled("vendor_commission"),
  ]);
  if (!v) notFound();
  return (
    <>
      <PageHeader title={`Edit ${v.name}`} />
      <VendorForm action={updateVendorAction.bind(null, vendorId)} initial={v} showCommission={showCommission} />
    </>
  );
}
