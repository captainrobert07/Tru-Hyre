import Link from "next/link";
import { notFound } from "next/navigation";
import { eq, desc } from "drizzle-orm";
import { db } from "@/db";
import { jobs, clientAccounts } from "@/db/schema";
import { isFeatureEnabled } from "@/lib/features";
import { APP_NAME, APP_TAGLINE } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "Careers" };

export default async function CareersPage() {
  if (!(await isFeatureEnabled("careers_page"))) notFound();

  const openJobs = await db
    .select({
      id: jobs.id,
      title: jobs.title,
      location: jobs.location,
      workMode: jobs.workMode,
      experienceMin: jobs.experienceMin,
      experienceMax: jobs.experienceMax,
      clientName: clientAccounts.name,
    })
    .from(jobs)
    .leftJoin(clientAccounts, eq(jobs.clientAccountId, clientAccounts.id))
    .where(eq(jobs.status, "open"))
    .orderBy(desc(jobs.createdAt))
    .limit(100);

  return (
    <main className="min-h-screen bg-canvas">
      <header className="border-b border-hairline bg-surface">
        <div className="max-w-3xl mx-auto px-6 py-8">
          <div className="flex items-center gap-2 mb-1">
            <span className="size-8 rounded-xl bg-brand-500 flex items-center justify-center text-white font-display italic">T</span>
            <span className="text-lg font-semibold">{APP_NAME}</span>
          </div>
          <h1 className="display text-display mt-4">Open roles</h1>
          <p className="text-ink-soft mt-2">{APP_TAGLINE}</p>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-6 py-8">
        {openJobs.length === 0 ? (
          <div className="card p-10 text-center text-ink-soft">No open roles right now. Check back soon.</div>
        ) : (
          <div className="space-y-3">
            {openJobs.map((j) => (
              <Link
                key={j.id}
                href={`/careers/${j.id}`}
                className="card p-5 flex items-center justify-between gap-4 hover:shadow-pop transition-shadow block"
              >
                <div className="min-w-0">
                  <div className="text-base font-semibold truncate">{j.title}</div>
                  <div className="text-sm text-ink-soft mt-0.5">
                    {[j.location, j.workMode, j.experienceMin ? `${j.experienceMin}–${j.experienceMax || "?"} yrs` : null]
                      .filter(Boolean)
                      .join(" · ") || "—"}
                  </div>
                </div>
                <span className="text-brand-700 text-sm shrink-0">Apply →</span>
              </Link>
            ))}
          </div>
        )}
        <p className="text-xs text-ink-muted text-center mt-10">
          {APP_NAME} — applications are reviewed by our recruiting team. We only use your data for hiring.
        </p>
      </div>
    </main>
  );
}
