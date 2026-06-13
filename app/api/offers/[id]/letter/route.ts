import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { offers, candidates, companyProfile } from "@/db/schema";
import { requireStaff } from "@/lib/rbac";
import { renderOfferLetterPdf } from "@/lib/packet";
import { logAudit } from "@/lib/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireStaff(); // staff-only; redirects otherwise
  const { id } = await params;
  const offerId = Number(id);
  if (!Number.isFinite(offerId)) return NextResponse.json({ error: "invalid_id" }, { status: 400 });

  const offer = (await db.select().from(offers).where(eq(offers.id, offerId)))[0];
  if (!offer) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const cand = (await db.select({ fullName: candidates.fullName, refId: candidates.refId }).from(candidates).where(eq(candidates.id, offer.candidateId)))[0];
  if (!cand) return NextResponse.json({ error: "candidate_not_found" }, { status: 404 });

  const company = (await db.select().from(companyProfile).limit(1))[0];

  const pdf = await renderOfferLetterPdf({
    candidateName: cand.fullName,
    refId: cand.refId,
    title: offer.title,
    ctc: offer.ctc,
    currency: offer.currency,
    joiningDate: offer.joiningDate,
    companyName: company?.name || "Tru Hyre",
    signerName: user.fullName || "The Hiring Team",
    // Date is rendered server-side at request time; acceptable here (route handler).
    dateStr: new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric" }).format(new Date()),
  });

  await logAudit({
    actorId: Number(user.id),
    actorEmail: user.email,
    action: "download",
    targetType: "offer",
    targetId: offerId,
    summary: `Generated offer letter for ${cand.fullName}`,
  });

  return new NextResponse(new Uint8Array(pdf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="offer-${cand.refId}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
