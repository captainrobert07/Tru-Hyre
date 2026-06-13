import Link from "next/link";
import { notFound } from "next/navigation";
import { isFeatureEnabled } from "@/lib/features";
import { APP_NAME } from "@/lib/utils";
import { VendorSignupForm } from "./signup-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Become a partner" };

export default async function VendorSignupPage() {
  if (!(await isFeatureEnabled("vendor_onboarding"))) notFound();
  return (
    <main className="min-h-screen bg-canvas">
      <header className="border-b border-hairline bg-surface">
        <div className="max-w-2xl mx-auto px-6 py-5 flex items-center gap-2">
          <span className="size-8 rounded-xl bg-brand-500 flex items-center justify-center text-white font-display italic">T</span>
          <span className="text-lg font-semibold">{APP_NAME}</span>
          <Link href="/careers" className="ml-auto text-sm text-brand-700 hover:underline">Open roles</Link>
        </div>
      </header>
      <div className="max-w-2xl mx-auto px-6 py-8">
        <h1 className="display text-display">Become a recruiting partner</h1>
        <p className="text-ink-soft mt-2 mb-6">Tell us about your agency. Approved partners can submit candidates to our open roles.</p>
        <VendorSignupForm />
      </div>
    </main>
  );
}
