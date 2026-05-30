import { requireStaff } from "@/lib/rbac";
import { PageHeader } from "@/components/primitives";
import { UploadForm } from "./upload-form";

export const metadata = { title: "Upload resume" };

export default async function UploadPage() {
  await requireStaff();
  return (
    <>
      <PageHeader
        title="New candidate"
        subtitle="Upload a PDF or paste resume text. Tru Hyre extracts the full profile and runs duplicate detection automatically."
      />
      <div className="card max-w-2xl p-6">
        <UploadForm />
      </div>
    </>
  );
}
