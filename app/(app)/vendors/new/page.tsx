import { requireStaff } from "@/lib/rbac";
import { PageHeader } from "@/components/primitives";
import { VendorForm } from "../vendor-form";
import { createVendorAction } from "../actions";

export const metadata = { title: "New vendor" };

export default async function NewVendorPage() {
  await requireStaff();
  return (
    <>
      <PageHeader title="New vendor" />
      <VendorForm action={createVendorAction} />
    </>
  );
}
