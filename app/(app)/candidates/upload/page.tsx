import { requireStaff } from "@/lib/rbac";
import { isFeatureEnabled } from "@/lib/features";
import { PageHeader } from "@/components/primitives";
import { UploadForm } from "./upload-form";

export const metadata = { title: "Upload resume" };

export default async function UploadPage() {
  await requireStaff();
  const [showSource, showLinks] = await Promise.all([
    isFeatureEnabled("source_tracking"),
    isFeatureEnabled("linkedin_import"),
  ]);
  return (
    <>
      <PageHeader
        title="New candidate"
        subtitle="Upload a PDF or paste resume text. Tru Hyre extracts the full profile and runs duplicate detection automatically."
      />
      <div className="card max-w-2xl p-6">
        <UploadForm showSource={showSource} showLinks={showLinks} />
      </div>
    </>
  );
}
