import { eq, desc } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { users, candidates, submissions, interviews, offers, stageHistory } from "@/db/schema";
import { requireCandidate } from "@/lib/rbac";
import { isFeatureEnabled } from "@/lib/features";
import { PageHeader, StatCard, StageBadge, Badge } from "@/components/primitives";
import { TimeAgo } from "@/components/time-ago";
import { signOut } from "@/auth";
import { APP_NAME } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "Your application" };

function fmt(iso: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }).format(new Date(iso));
  } catch { return iso; }
}

export default async function CandidatePortal() {
  const sessionUser = await requireCandidate();
  if (!(await isFeatureEnabled("candidate_portal"))) notFound();

  // DATA ISOLATION: resolve the linked candidate id from the DB user record —
  // NEVER from a client-supplied value — and key every query to exactly it.
  const me = (await db.select({ candidateProfileId: users.candidateProfileId }).from(users).where(eq(users.id, Number(sessionUser.id))))[0];
  const profileId = me?.candidateProfileId ?? null;

  const cand = profileId
    ? (await db.select().from(candidates).where(eq(candidates.id, profileId)))[0]
    : null;

  if (!cand) {
    return (
      <PortalShell>
        <div className="card p-8 text-center text-ink-soft">
          Your portal isn&apos;t linked to an application yet. Please contact your recruiter.
        </div>
      </PortalShell>
    );
  }

  const [subs, ivs, candOffers, history] = await Promise.all([
    db.select({ id: submissions.id, jobId: submissions.jobId, status: submissions.status, createdAt: submissions.createdAt }).from(submissions).where(eq(submissions.candidateId, profileId!)).orderBy(desc(submissions.createdAt)),
    db.select({ id: interviews.id, title: interviews.title, mode: interviews.mode, scheduledStart: interviews.scheduledStart, status: interviews.status, meetLink: interviews.meetLink }).from(interviews).where(eq(interviews.candidateId, profileId!)).orderBy(desc(interviews.scheduledStart)),
    db.select({ id: offers.id, title: offers.title, status: offers.status, joiningDate: offers.joiningDate }).from(offers).where(eq(offers.candidateId, profileId!)).orderBy(desc(offers.createdAt)),
    db.select({ id: stageHistory.id, toStage: stageHistory.toStage, createdAt: stageHistory.createdAt }).from(stageHistory).where(eq(stageHistory.candidateId, profileId!)).orderBy(desc(stageHistory.createdAt)).limit(15),
  ]);

  const upcomingIvs = ivs.filter((i) => i.status === "scheduled" && new Date(i.scheduledStart).getTime() >= Date.now());
  const activeOffer = candOffers.find((o) => o.status === "extended" || o.status === "accepted");

  return (
    <PortalShell>
      <PageHeader title={`Hi, ${cand.fullName.split(/\s+/)[0]}`} subtitle="Here's where your application stands." />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard label="Current stage" value={<StageBadge stage={cand.stage} />} />
        <StatCard label="Applications" value={subs.length} />
        <StatCard label="Interviews" value={ivs.length} />
        <StatCard label="Offers" value={candOffers.length} tone={activeOffer ? "good" : "default"} />
      </div>

      {activeOffer && (
        <section className="card p-5 mb-4 bg-brand-50 border-brand-100">
          <h2 className="text-sm font-semibold text-brand-900">🎉 You have an offer</h2>
          <p className="text-sm text-brand-800 mt-1">{activeOffer.title || "Offer"}{activeOffer.joiningDate ? ` · joining ${activeOffer.joiningDate}` : ""} — status: {activeOffer.status}. Your recruiter will be in touch with details.</p>
        </section>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <section className="card p-5">
          <h2 className="text-sm font-semibold mb-3">Upcoming interviews</h2>
          {upcomingIvs.length === 0 ? (
            <p className="text-sm text-ink-soft">No interviews scheduled.</p>
          ) : (
            <ul className="space-y-2">
              {upcomingIvs.map((i) => (
                <li key={i.id} className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{i.title}</div>
                    <div className="text-xs text-ink-soft">{fmt(i.scheduledStart.toISOString())}</div>
                  </div>
                  {i.mode === "video" && i.meetLink ? (
                    <a href={i.meetLink} target="_blank" rel="noopener noreferrer" className="text-xs text-brand-700 hover:underline shrink-0">Join ↗</a>
                  ) : <Badge tone="amber">{i.mode}</Badge>}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card p-5">
          <h2 className="text-sm font-semibold mb-3">Your progress</h2>
          {history.length === 0 ? (
            <p className="text-sm text-ink-soft">No updates yet.</p>
          ) : (
            <ol className="space-y-2">
              {history.map((h) => (
                <li key={h.id} className="flex items-center justify-between gap-2 text-sm">
                  <StageBadge stage={h.toStage} />
                  <span className="text-[11px] text-ink-muted"><TimeAgo date={h.createdAt} /></span>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
    </PortalShell>
  );
}

function PortalShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-canvas">
      <header className="border-b border-hairline bg-surface">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center gap-2">
          <span className="size-8 rounded-xl bg-brand-500 flex items-center justify-center text-white font-display italic">T</span>
          <span className="text-lg font-semibold">{APP_NAME}</span>
          <form className="ml-auto" action={async () => { "use server"; await signOut({ redirectTo: "/login" }); }}>
            <button className="text-xs text-ink-soft hover:text-ink" type="submit">Sign out</button>
          </form>
        </div>
      </header>
      <div className="max-w-4xl mx-auto px-6 py-8">{children}</div>
    </main>
  );
}
