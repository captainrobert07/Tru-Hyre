import { requireStaff } from "@/lib/rbac";
import { PageHeader } from "@/components/primitives";
import { UploadForm } from "./upload-form";

export const metadata = { title: "Upload resume" };

export default async function UploadPage() {
  await requireStaff();
  return (
    <>
      <PageHeader
        title="Upload resume"
        subtitle="PDF only — Tru Hyre auto-parses name, email, phone, and skills, then runs duplicate detection."
      />
      <div className="card max-w-2xl p-6">
        <UploadForm />
      </div>
    </>
  );
}
