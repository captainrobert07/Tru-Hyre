import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { schedulingLinks } from "@/db/schema";
import { isFeatureEnabled } from "@/lib/features";
import { APP_NAME } from "@/lib/utils";
import { SlotPicker } from "./slot-picker";

export const dynamic = "force-dynamic";
export const metadata = { title: "Schedule your interview" };

export default async function SchedulePage({ params }: { params: Promise<{ token: string }> }) {
  if (!(await isFeatureEnabled("self_scheduling"))) notFound();
  const { token } = await params;
  // The token is the sole credential — it resolves to exactly one link/candidate.
  const link = (await db.select().from(schedulingLinks).where(eq(schedulingLinks.token, token)))[0];
  if (!link) notFound();

  const expired = new Date(link.expiresAt).getTime() < Date.now();
  const booked = Boolean(link.bookedSlot);

  return (
    <main className="min-h-screen bg-canvas">
      <header className="border-b border-hairline bg-surface">
        <div className="max-w-xl mx-auto px-6 py-5 flex items-center gap-2">
          <span className="size-8 rounded-xl bg-brand-500 flex items-center justify-center text-white font-display italic">T</span>
          <span className="text-lg font-semibold">{APP_NAME}</span>
        </div>
      </header>
      <div className="max-w-xl mx-auto px-6 py-8">
        <h1 className="display text-display">{link.title}</h1>
        <p className="text-ink-soft mt-2 mb-6">Schedule your interview at a time that suits you.</p>
        {booked ? (
          <div className="card p-8 text-center">
            <div className="text-3xl mb-2">📅</div>
            <h2 className="text-lg font-semibold">Already scheduled</h2>
            <p className="text-sm text-ink-soft mt-2">This interview has been booked. Check your email for the calendar invite.</p>
          </div>
        ) : expired ? (
          <div className="card p-8 text-center text-ink-soft">This scheduling link has expired. Please contact your recruiter for a new one.</div>
        ) : (
          <SlotPicker token={token} slots={link.slots} />
        )}
      </div>
    </main>
  );
}
