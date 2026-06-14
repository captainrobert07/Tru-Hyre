import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { jobs } from "@/db/schema";
import { isFeatureEnabled } from "@/lib/features";
import { APP_NAME } from "@/lib/utils";
import { ApplyForm } from "./apply-form";

export const dynamic = "force-dynamic";

export default async function CareersJobPage({ params }: { params: Promise<{ id: string }> }) {
  if (!(await isFeatureEnabled("careers_page"))) notFound();
  const { id } = await params;
  const jobId = Number(id);
  if (!Number.isFinite(jobId)) notFound();

  const job = (await db.select().from(jobs).where(eq(jobs.id, jobId)))[0];
  if (!job || job.status !== "open") notFound();

  const collectDiversity = await isFeatureEnabled("diversity_reporting");

  return (
    <main className="min-h-screen bg-canvas">
      <header className="border-b border-hairline bg-surface">
        <div className="max-w-3xl mx-auto px-6 py-5 flex items-center gap-2">
          <span className="size-8 rounded-xl bg-brand-500 flex items-center justify-center text-white font-display italic">T</span>
          <span className="text-lg font-semibold">{APP_NAME}</span>
          <Link href="/careers" className="ml-auto text-sm text-brand-700 hover:underline">All roles</Link>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-3">
          <h1 className="display text-display">{job.title}</h1>
          <div className="text-sm text-ink-soft mt-2">
            {[job.location, job.workMode, job.experienceMin ? `${job.experienceMin}–${job.experienceMax || "?"} yrs` : null]
              .filter(Boolean)
              .join(" · ") || "—"}
          </div>
          {job.skills && job.skills.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-4">
              {job.skills.map((s) => (
                <span key={s} className="inline-flex items-center px-2.5 h-6 text-xs rounded-full bg-blue-50 text-blue-700">{s}</span>
              ))}
            </div>
          )}
          <div className="prose prose-sm mt-6 text-sm leading-relaxed text-ink-soft whitespace-pre-line">
            {job.description || "No description provided."}
          </div>
        </div>

        <div className="lg:col-span-2">
          <h2 className="text-sm font-semibold mb-3">Apply</h2>
          <ApplyForm jobId={job.id} collectDiversity={collectDiversity} />
        </div>
      </div>
    </main>
  );
}
