import { NextResponse } from "next/server";
import { exportCandidateData } from "@/app/(app)/candidates/[id]/actions";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const candidateId = Number(id);
  if (!Number.isFinite(candidateId)) {
    return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  }

  let data: Record<string, unknown> | null;
  try {
    data = await exportCandidateData(candidateId);
  } catch {
    // exportCandidateData throws when the GDPR tools feature is disabled.
    return NextResponse.json({ error: "feature_disabled" }, { status: 403 });
  }
  if (!data) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const refId = (data.candidate as { refId?: string }).refId || `candidate-${candidateId}`;
  const filename = `tru-hyre-${refId}.json`;

  return new NextResponse(JSON.stringify(data, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
