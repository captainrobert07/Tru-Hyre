import { requireStaff } from "@/lib/rbac";
import { isFeatureEnabled } from "@/lib/features";
import { PageHeader } from "@/components/primitives";
import { VendorForm } from "../vendor-form";
import { createVendorAction } from "../actions";

export const metadata = { title: "New vendor" };

export default async function NewVendorPage() {
  await requireStaff();
  const showCommission = await isFeatureEnabled("vendor_commission");
  return (
    <>
      <PageHeader title="New vendor" />
      <VendorForm action={createVendorAction} showCommission={showCommission} />
    </>
  );
}
