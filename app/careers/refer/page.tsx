import Link from "next/link";
import { notFound } from "next/navigation";
import { eq, desc } from "drizzle-orm";
import { db } from "@/db";
import { jobs } from "@/db/schema";
import { isFeatureEnabled } from "@/lib/features";
import { APP_NAME } from "@/lib/utils";
import { ReferForm } from "./refer-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Refer a candidate" };

export default async function ReferPage() {
  if (!(await isFeatureEnabled("referral_portal"))) notFound();

  const openJobs = await db
    .select({ id: jobs.id, title: jobs.title })
    .from(jobs)
    .where(eq(jobs.status, "open"))
    .orderBy(desc(jobs.createdAt))
    .limit(100);

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
        <h1 className="display text-display">Refer someone great</h1>
        <p className="text-ink-soft mt-2 mb-6">Know someone who&apos;d be a fit? Send them our way.</p>
        <ReferForm openJobs={openJobs} />
      </div>
    </main>
  );
}
