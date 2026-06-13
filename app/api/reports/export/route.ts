import { NextResponse } from "next/server";
import { requireStaff } from "@/lib/rbac";
import { isFeatureEnabled } from "@/lib/features";
import {
  getCoverageRatio, getOfferAcceptance, getJoinedCompensation,
  getSubmissionForecast, getSourceEffectiveness, getBottlenecks,
} from "@/lib/metrics";
import { logAudit } from "@/lib/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function csvRow(cells: (string | number | null)[]): string {
  return cells.map((c) => {
    const s = c === null || c === undefined ? "" : String(c);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }).join(",");
}

export async function GET() {
  const user = await requireStaff();
  if (!(await isFeatureEnabled("analytics_reports"))) {
    return NextResponse.json({ error: "reports disabled" }, { status: 404 });
  }

  const [coverage, acceptance, comp, forecast, sources, bottlenecks] = await Promise.all([
    getCoverageRatio(), getOfferAcceptance(365), getJoinedCompensation(),
    getSubmissionForecast(), getSourceEffectiveness(365), getBottlenecks(),
  ]);

  const lines: string[] = [];
  lines.push(csvRow(["Tru Hyre — Executive Report"]));
  lines.push(csvRow(["Metric", "Value", "Detail"]));
  lines.push(csvRow(["Coverage ratio", coverage.ratio, `${coverage.activeCandidates} active / ${coverage.openPositions} positions`]));
  lines.push(csvRow(["Offer acceptance %", acceptance.acceptanceRate, `${acceptance.joins}/${acceptance.offers + acceptance.joins} joined (1y)`]));
  lines.push(csvRow(["Median joined CTC", comp.median ?? "", `${comp.sampleCount} hires`]));
  lines.push(csvRow(["Weekly submission avg", forecast.weeklyAvg, `projected ${forecast.projectedThisMonth} this month`]));
  lines.push(csvRow([]));
  lines.push(csvRow(["Source", "Candidates", "Submitted", "Interviewed", "Offers", "Joined", "Join rate %"]));
  for (const s of sources) lines.push(csvRow([s.source, s.candidates, s.submitted, s.interviewed, s.offers, s.joins, s.joinRate]));
  lines.push(csvRow([]));
  lines.push(csvRow(["Stage", "Stuck", "Median days in stage"]));
  for (const b of bottlenecks) lines.push(csvRow([b.stage, b.stuck, b.medianDaysInStage]));

  await logAudit({
    actorId: Number(user.id), actorEmail: user.email,
    action: "download", targetType: "report", summary: "Exported executive report CSV",
  });

  return new NextResponse(lines.join("\n"), {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="tru-hyre-exec-report.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
