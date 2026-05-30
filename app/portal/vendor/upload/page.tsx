import Link from "next/link";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users, vendorAccounts, jobs, jobVendors } from "@/db/schema";
import { requireVendor } from "@/lib/rbac";
import { signOut } from "@/auth";
import { APP_NAME } from "@/lib/utils";
import { vendorUploadResumeAction } from "./actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Submit candidate" };

export default async function VendorUploadPage() {
  const me = await requireVendor();
  const u = (await db.select().from(users).where(eq(users.id, Number(me.id))))[0];
  if (!u || !u.vendorAccountId) {
    return (
      <main className="login-bg min-h-screen flex items-center justify-center px-4">
        <div className="card max-w-md p-8 space-y-2">
          <h1 className="text-xl font-semibold">No vendor account linked</h1>
          <p className="text-sm text-ink-soft">Contact your Tru Hyre admin.</p>
          <Link href="/login" className="btn-ghost text-sm mt-2 inline-block">Back to sign in</Link>
        </div>
      </main>
    );
  }
  const vendor = (await db.select().from(vendorAccounts).where(eq(vendorAccounts.id, u.vendorAccountId)))[0];

  const assignedJobs = await db
    .select({ id: jobs.id, title: jobs.title, status: jobs.status, location: jobs.location })
    .from(jobVendors)
    .innerJoin(jobs, eq(jobVendors.jobId, jobs.id))
    .where(eq(jobVendors.vendorAccountId, u.vendorAccountId));

  return (
    <main className="min-h-screen bg-canvas">
      <header className="bg-surface border-b border-hairline">
        <div className="max-w-4xl mx-auto px-4 md:px-8 h-14 flex items-center justify-between">
          <Link href="/portal/vendor" className="text-sm font-semibold">← {APP_NAME} · Vendor Portal</Link>
          <form action={async () => { "use server"; await signOut({ redirectTo: "/login" }); }}>
            <button type="submit" className="text-xs text-ink-soft hover:text-ink">Sign out</button>
          </form>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 md:px-8 py-6 md:py-10">
        <div className="mb-6">
          <h1 className="display text-3xl md:text-4xl">Submit a <em>candidate</em></h1>
          <p className="text-sm text-ink-soft mt-2">
            {vendor?.name} · uploads land in HR review for {APP_NAME} to screen and submit to client jobs.
          </p>
        </div>

        <form action={vendorUploadResumeAction} className="card p-6 space-y-4">
          <div>
            <label htmlFor="file" className="label">PDF resume</label>
            <input
              id="file"
              name="file"
              type="file"
              accept="application/pdf,.pdf"
              required
              className="input file:mr-3 file:btn-ghost file:text-xs file:px-2 file:py-1 file:h-7 cursor-pointer"
            />
            <p className="text-xs text-ink-muted mt-1.5">
              Max 10 MB. Tru Hyre auto-extracts name, contact, location, experience, notice, CTC, summary, and skills.
            </p>
          </div>
          <button type="submit" className="btn-brand">Submit candidate</button>
        </form>

        {assignedJobs.length > 0 && (
          <section className="mt-8">
            <h2 className="text-sm font-semibold mb-3">Open jobs you&apos;re assigned to</h2>
            <div className="card divide-y divide-hairline overflow-hidden">
              {assignedJobs.filter((j) => j.status === "open").map((j) => (
                <Link
                  key={j.id}
                  href={`/portal/vendor/jobs/${j.id}`}
                  className="px-4 py-3 flex justify-between items-center text-sm hover:bg-canvas"
                >
                  <span>
                    <span className="font-medium">{j.title}</span>
                    <span className="text-ink-muted text-xs ml-2">{j.location}</span>
                  </span>
                  <span className="text-xs text-brand-700">View spec →</span>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
