import { redirect } from "next/navigation";
import { desc } from "drizzle-orm";
import { db } from "@/db";
import { savedReports } from "@/db/schema";
import { requireStaff } from "@/lib/rbac";
import { isFeatureEnabled } from "@/lib/features";
import { PageHeader, Badge } from "@/components/primitives";
import { Breadcrumbs } from "@/components/breadcrumbs";
import {
  getSourceEffectiveness, getCycleTimePerStage, getVendorSlaCompliance,
  getRecruiterScoreboard, getBottlenecks, getLocationMix,
} from "@/lib/metrics";
import { saveReportAction } from "./actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Custom report" };

const MEASURES: { key: string; label: string }[] = [
  { key: "source_effectiveness", label: "Source effectiveness" },
  { key: "cycle_time", label: "Cycle time per stage" },
  { key: "vendor_sla", label: "Vendor SLA compliance" },
  { key: "recruiter_scoreboard", label: "Recruiter scoreboard" },
  { key: "bottlenecks", label: "Pipeline bottlenecks" },
  { key: "location_mix", label: "Location mix" },
];

// Run a measure → { columns, rows } for a generic table render.
async function runMeasure(measure: string, days: number): Promise<{ columns: string[]; rows: (string | number)[][] }> {
  switch (measure) {
    case "source_effectiveness": {
      const d = await getSourceEffectiveness(days);
      return { columns: ["Source", "Candidates", "Submitted", "Interviewed", "Offers", "Joined", "Join %"], rows: d.map((r) => [r.source, r.candidates, r.submitted, r.interviewed, r.offers, r.joins, r.joinRate]) };
    }
    case "cycle_time": {
      const d = await getCycleTimePerStage(days);
      return { columns: ["Stage", "Median days", "Sample"], rows: d.map((r) => [r.stage, r.medianDays, r.sampleCount]) };
    }
    case "vendor_sla": {
      const d = await getVendorSlaCompliance(days, 48);
      return { columns: ["Vendor", "Within SLA", "Total", "Rate %"], rows: d.map((r) => [r.vendorName, r.withinSla, r.total, r.rate]) };
    }
    case "recruiter_scoreboard": {
      const d = await getRecruiterScoreboard(days);
      return { columns: ["Recruiter", "Uploads", "Submitted", "Offers", "Joins"], rows: d.map((r) => [r.fullName || r.email, r.uploads, r.submitted, r.offers, r.joins]) };
    }
    case "bottlenecks": {
      const d = await getBottlenecks();
      return { columns: ["Stage", "Stuck", "Median days"], rows: d.map((r) => [r.stage, r.stuck, r.medianDaysInStage]) };
    }
    case "location_mix": {
      const d = await getLocationMix();
      return { columns: ["Location", "Count"], rows: d.map((r) => [r.location, r.count]) };
    }
    default:
      return { columns: [], rows: [] };
  }
}

export default async function CustomReportPage({ searchParams }: { searchParams: Promise<{ measure?: string; days?: string }> }) {
  await requireStaff();
  if (!(await isFeatureEnabled("custom_report_builder"))) redirect("/reports");
  const sp = await searchParams;
  const measure = MEASURES.some((m) => m.key === sp.measure) ? sp.measure! : "source_effectiveness";
  const days = Math.max(1, Math.min(3650, Number(sp.days) || 90));

  const [result, saved] = await Promise.all([
    runMeasure(measure, days),
    db.select().from(savedReports).orderBy(desc(savedReports.createdAt)).limit(20),
  ]);

  return (
    <>
      <Breadcrumbs crumbs={[{ href: "/dashboard", label: "Dashboard" }, { href: "/reports", label: "Reports" }, { label: "Custom" }]} />
      <PageHeader title="Custom report" subtitle="Pick a metric and date range. Save definitions to revisit." />

      <form method="get" className="card p-4 mb-4 flex flex-wrap items-end gap-3">
        <div>
          <label className="label">Measure</label>
          <select name="measure" defaultValue={measure} className="input text-sm">
            {MEASURES.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Window (days)</label>
          <input name="days" type="number" min={1} max={3650} defaultValue={days} className="input text-sm w-28" />
        </div>
        <button type="submit" className="btn-primary text-sm">Run</button>
      </form>

      <section className="card p-5 mb-4 overflow-x-auto">
        <h2 className="text-base font-semibold mb-3">{MEASURES.find((m) => m.key === measure)?.label}</h2>
        {result.rows.length === 0 ? (
          <p className="text-sm text-ink-muted">No data for this window.</p>
        ) : (
          <table className="w-full text-sm min-w-[480px]">
            <thead className="text-xs text-ink-muted uppercase tracking-wide">
              <tr>{result.columns.map((c, i) => <th key={i} className={`pb-2 ${i === 0 ? "text-left" : "text-right"} px-3`}>{c}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-hairline">
              {result.rows.map((row, ri) => (
                <tr key={ri} className="hover:bg-canvas">
                  {row.map((cell, ci) => <td key={ci} className={`py-2 px-3 tabular-nums ${ci === 0 ? "text-left font-medium" : "text-right text-ink-soft"}`}>{cell}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <form
        action={async (fd) => {
          "use server";
          await saveReportAction(fd);
        }}
        className="card p-4 mb-4 flex flex-wrap items-end gap-3"
      >
        <input type="hidden" name="measure" value={measure} />
        <input type="hidden" name="days" value={days} />
        <div className="flex-1 min-w-[200px]">
          <label className="label" htmlFor="custom-report-name">Save this view as</label>
          <input id="custom-report-name" name="name" placeholder="e.g. Q3 source effectiveness" className="input text-sm" />
        </div>
        <button type="submit" className="btn-ghost text-sm">Save report</button>
      </form>

      {saved.length > 0 && (
        <section className="card p-5">
          <h2 className="text-sm font-semibold mb-3">Saved reports</h2>
          <ul className="divide-y divide-hairline">
            {saved.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                <a href={`/reports/custom?measure=${r.measure}&days=${r.days}`} className="text-brand-700 hover:underline">{r.name}</a>
                <Badge tone="default">{MEASURES.find((m) => m.key === r.measure)?.label || r.measure} · {r.days}d</Badge>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
