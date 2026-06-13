import Link from "next/link";
import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/rbac";
import { isFeatureEnabled } from "@/lib/features";
import { PageHeader, StatCard, Badge } from "@/components/primitives";
import {
  getSourceOfHire,
  getSourceEffectiveness,
  getCycleTimePerStage,
  getLocationMix,
  getOfferAcceptance,
  getVendorSlaCompliance,
  getJoinedCompensation,
  getRecruiterScoreboard,
  getCoverageRatio,
  getStageDistribution,
  getSubmissionForecast,
} from "@/lib/metrics";

export const dynamic = "force-dynamic";
export const metadata = { title: "Reports" };

export default async function ReportsPage() {
  await requireStaff();
  if (!(await isFeatureEnabled("analytics_reports"))) redirect("/dashboard");
  const showSourceEff = await isFeatureEnabled("source_tracking");

  const [
    source,
    sourceEff,
    cycle,
    locations,
    acceptance,
    sla,
    comp,
    scoreboard,
    coverage,
    distribution,
    forecast,
  ] = await Promise.all([
    getSourceOfHire(90),
    getSourceEffectiveness(365),
    getCycleTimePerStage(180),
    getLocationMix(),
    getOfferAcceptance(365),
    getVendorSlaCompliance(60, 48),
    getJoinedCompensation(),
    getRecruiterScoreboard(30),
    getCoverageRatio(),
    getStageDistribution(),
    getSubmissionForecast(),
  ]);

  const sourceMax = Math.max(1, ...source.map((s) => s.count));
  const locationMax = Math.max(1, ...locations.map((l) => l.count));

  // Group stage distribution into a per-stage map of bucket->count
  const distMap = new Map<string, Map<string, number>>();
  for (const r of distribution) {
    if (!distMap.has(r.stage)) distMap.set(r.stage, new Map());
    distMap.get(r.stage)!.set(r.bucket, r.n);
  }
  const distStages = [...distMap.keys()];
  const distBuckets = ["0-1d", "1-3d", "3-7d", "7-14d", "14-30d", "30+d"] as const;

  return (
    <>
      <PageHeader
        title="Reports"
        subtitle="Pipeline conversion, vendor quality, recruiter performance, and forecasting."
      />

      {/* Top KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard
          label="Coverage ratio"
          value={coverage.ratio.toFixed(1)}
          tone={coverage.ratio >= 3 ? "good" : coverage.ratio >= 1 ? "default" : "attention"}
          hint={`${coverage.activeCandidates} active / ${coverage.openPositions} positions`}
          tooltip="Active candidates ÷ open positions across all open jobs. >3 healthy, 1-3 tight, <1 starved."
        />
        <StatCard
          label="Offer acceptance"
          value={`${acceptance.acceptanceRate}%`}
          tone={acceptance.acceptanceRate >= 80 ? "good" : "default"}
          hint={`${acceptance.joins} joined / ${acceptance.offers + acceptance.joins} offers (1y)`}
          tooltip="Of every offer that closed in the last year, what fraction joined? Rejected offers count against this rate."
        />
        <StatCard
          label="4-wk submission avg"
          value={forecast.weeklyAvg}
          hint={`projected ${forecast.projectedThisMonth} this month`}
          tone="info"
          tooltip="Average submissions per week over the trailing 4 weeks. Used to project this calendar month."
        />
        <StatCard
          label="Median joined CTC"
          value={comp.median ? formatCompact(comp.median) : "—"}
          hint={comp.sampleCount > 0 ? `from ${comp.sampleCount} hire${comp.sampleCount === 1 ? "" : "s"}` : "no joined candidates yet"}
          tooltip="Median expected CTC across all joined candidates. Proxy for cost-per-hire."
        />
      </div>

      {/* Forecast strip */}
      <section className="card p-5 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold">Submission forecast</h2>
          <span className="text-xs text-ink-muted">Trailing 4 weeks</span>
        </div>
        <div className="flex items-end gap-3 h-28 mb-3">
          {forecast.trailingFourWeeks.map((n, i) => {
            const max = Math.max(1, ...forecast.trailingFourWeeks);
            const pct = (n / max) * 100;
            const isLatest = i === forecast.trailingFourWeeks.length - 1;
            return (
              <div key={i} className="flex-1 flex flex-col items-center gap-2">
                <div className="text-xs text-ink-soft tabular-nums">{n}</div>
                <div
                  className={`w-full rounded-md min-h-[4px] ${
                    isLatest
                      ? "bg-gradient-to-b from-brand-400 to-brand-700"
                      : "bg-canvas border border-hairline"
                  }`}
                  style={{ height: `${Math.max(8, pct)}%` }}
                />
                <span className="text-[10px] text-ink-muted">
                  {i === 3 ? "this wk" : `wk -${3 - i}`}
                </span>
              </div>
            );
          })}
        </div>
        <p className="text-xs text-ink-soft">
          At {forecast.weeklyAvg}/week pace, expect <strong className="text-ink">{forecast.projectedThisMonth}</strong> submissions this calendar month.
        </p>
      </section>

      {/* Source of hire + Location mix */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <section className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold">Source of hire</h2>
            <span className="text-xs text-ink-muted">Last 90 days</span>
          </div>
          {source.length === 0 ? (
            <Empty msg="No submissions in the last 90 days." />
          ) : (
            <ul className="space-y-2.5">
              {source.map((s) => (
                <li key={s.source}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="truncate">{s.source}</span>
                    <span className="text-ink-muted tabular-nums">{s.count}</span>
                  </div>
                  <div className="h-2 bg-canvas rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-brand-400 to-brand-700"
                      style={{ width: `${(s.count / sourceMax) * 100}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold">Location mix</h2>
            <span className="text-xs text-ink-muted">All candidates</span>
          </div>
          {locations.length === 0 ? (
            <Empty msg="No candidates yet." />
          ) : (
            <ul className="space-y-2.5">
              {locations.map((l) => (
                <li key={l.location}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="truncate">{l.location}</span>
                    <span className="text-ink-muted tabular-nums">{l.count}</span>
                  </div>
                  <div className="h-2 bg-canvas rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-400"
                      style={{ width: `${(l.count / locationMax) * 100}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* Source effectiveness funnel */}
      {showSourceEff && (
      <section className="card p-5 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold">Source effectiveness</h2>
          <span className="text-xs text-ink-muted">Last 12 months</span>
        </div>
        {sourceEff.length === 0 ? (
          <Empty msg="No candidates yet." />
        ) : (
          <div className="overflow-x-auto -mx-5">
            <table className="w-full text-sm min-w-[620px]">
              <thead className="text-xs text-ink-muted uppercase tracking-wide">
                <tr>
                  <th className="text-left font-medium px-5 pb-2">Source</th>
                  <th className="text-right font-medium px-3 pb-2">Candidates</th>
                  <th className="text-right font-medium px-3 pb-2">Submitted</th>
                  <th className="text-right font-medium px-3 pb-2">Interviewed</th>
                  <th className="text-right font-medium px-3 pb-2">Offers</th>
                  <th className="text-right font-medium px-3 pb-2">Joined</th>
                  <th className="text-right font-medium px-5 pb-2">Join rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline">
                {sourceEff.map((s) => (
                  <tr key={s.source} className="hover:bg-canvas">
                    <td className="px-5 py-2.5 font-medium">{s.source}</td>
                    <td className="text-right tabular-nums px-3 py-2.5 text-ink-soft">{s.candidates}</td>
                    <td className="text-right tabular-nums px-3 py-2.5 text-ink-soft">{s.submitted}</td>
                    <td className="text-right tabular-nums px-3 py-2.5 text-ink-soft">{s.interviewed}</td>
                    <td className="text-right tabular-nums px-3 py-2.5 text-ink-soft">{s.offers}</td>
                    <td className="text-right tabular-nums px-3 py-2.5 font-semibold text-brand-700">{s.joins}</td>
                    <td className="text-right px-5 py-2.5">
                      <Badge tone={s.joinRate >= 20 ? "green" : s.joinRate >= 5 ? "amber" : "default"}>{s.joinRate}%</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-[11px] text-ink-muted mt-3">
          Join rate = joined ÷ candidates from that source. Set a candidate&apos;s source at upload or on their profile.
        </p>
      </section>
      )}

      {/* Cycle time + Vendor SLA */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <section className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold">Cycle time per stage</h2>
            <span className="text-xs text-ink-muted">Median days, 180d</span>
          </div>
          {cycle.length === 0 ? (
            <Empty msg="Not enough stage transitions yet." />
          ) : (
            <ul className="space-y-2">
              {cycle.map((c) => (
                <li key={c.stage} className="flex items-center justify-between text-sm py-1.5 border-b border-hairline last:border-0">
                  <span className="capitalize">{c.stage.replaceAll("_", " ")}</span>
                  <span className="flex items-center gap-2">
                    <Badge tone={c.medianDays > 7 ? "amber" : "default"}>{c.medianDays}d</Badge>
                    <span className="text-[11px] text-ink-muted">{c.sampleCount}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className="text-[11px] text-ink-muted mt-3">
            Sample = number of completed transitions through that stage.
          </p>
        </section>

        <section className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold">Vendor SLA compliance</h2>
            <span className="text-xs text-ink-muted">48h to first move, 60d</span>
          </div>
          {sla.length === 0 ? (
            <Empty msg="No vendor uploads in the last 60 days." />
          ) : (
            <ul className="space-y-3">
              {sla.map((v) => (
                <li key={v.vendorId}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="truncate font-medium">{v.vendorName}</span>
                    <span className="flex items-center gap-2">
                      <span className="text-xs text-ink-muted tabular-nums">
                        {v.withinSla}/{v.total}
                      </span>
                      <Badge tone={v.rate >= 80 ? "green" : v.rate >= 50 ? "amber" : "red"}>
                        {v.rate}%
                      </Badge>
                    </span>
                  </div>
                  <div className="h-2 bg-canvas rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        v.rate >= 80 ? "bg-brand-500" : v.rate >= 50 ? "bg-amber-500" : "bg-red-500"
                      }`}
                      style={{ width: `${v.rate}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* Recruiter scoreboard */}
      <section className="card p-5 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold">Recruiter scoreboard</h2>
          <span className="text-xs text-ink-muted">Last 30 days</span>
        </div>
        {scoreboard.length === 0 ? (
          <Empty msg="No recruiter activity in the last 30 days." />
        ) : (
          <div className="overflow-x-auto -mx-5">
            <table className="w-full text-sm min-w-[560px]">
              <thead className="text-xs text-ink-muted uppercase tracking-wide">
                <tr>
                  <th className="text-left font-medium px-5 pb-2">Recruiter</th>
                  <th className="text-right font-medium px-3 pb-2">Uploads</th>
                  <th className="text-right font-medium px-3 pb-2">Submitted</th>
                  <th className="text-right font-medium px-3 pb-2">Offers</th>
                  <th className="text-right font-medium px-3 pb-2">Joined</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline">
                {scoreboard.map((s, i) => (
                  <tr key={s.recruiterId} className="hover:bg-canvas">
                    <td className="px-5 py-2.5">
                      <div className="flex items-center gap-2">
                        {i < 3 && (
                          <span className={`size-5 rounded-full text-[10px] font-bold flex items-center justify-center ${
                            i === 0 ? "bg-brand-500 text-white" : i === 1 ? "bg-brand-200 text-brand-900" : "bg-amber-100 text-amber-700"
                          }`}>
                            {i + 1}
                          </span>
                        )}
                        <div>
                          <div className="font-medium truncate">{s.fullName || s.email}</div>
                          {s.fullName && <div className="text-[11px] text-ink-muted truncate">{s.email}</div>}
                        </div>
                      </div>
                    </td>
                    <td className="text-right tabular-nums px-3 py-2.5 text-ink-soft">{s.uploads}</td>
                    <td className="text-right tabular-nums px-3 py-2.5 text-ink-soft">{s.submitted}</td>
                    <td className="text-right tabular-nums px-3 py-2.5 text-ink-soft">{s.offers}</td>
                    <td className="text-right tabular-nums px-3 py-2.5 font-semibold text-brand-700">{s.joins}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-[11px] text-ink-muted mt-3">
          Rank = (10 × joins) + (5 × offers) + (2 × submissions) + uploads.
        </p>
      </section>

      {/* Time-in-stage distribution */}
      <section className="card p-5 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold">Time-in-stage distribution</h2>
          <span className="text-xs text-ink-muted">Active candidates only</span>
        </div>
        {distStages.length === 0 ? (
          <Empty msg="No active candidates." />
        ) : (
          <div className="space-y-3">
            {distStages.map((stage) => {
              const buckets = distMap.get(stage)!;
              const totals = [...buckets.values()].reduce((a, b) => a + b, 0);
              return (
                <div key={stage}>
                  <div className="flex items-center justify-between text-sm mb-1.5">
                    <span className="capitalize font-medium">{stage.replaceAll("_", " ")}</span>
                    <span className="text-xs text-ink-muted tabular-nums">{totals}</span>
                  </div>
                  <div className="flex h-6 rounded-full overflow-hidden bg-canvas">
                    {distBuckets.map((b, i) => {
                      const n = buckets.get(b) || 0;
                      const pct = totals > 0 ? (n / totals) * 100 : 0;
                      if (pct === 0) return null;
                      const colors = ["bg-brand-500", "bg-brand-400", "bg-blue-400", "bg-amber-400", "bg-attention-500", "bg-red-500"];
                      return (
                        <div
                          key={b}
                          title={`${b}: ${n}`}
                          className={`${colors[i]} flex items-center justify-center text-[10px] text-white font-medium tabular-nums`}
                          style={{ width: `${pct}%` }}
                        >
                          {pct >= 8 ? `${n}` : ""}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
            <div className="flex flex-wrap gap-2 mt-4 text-[10px] text-ink-muted">
              {distBuckets.map((b, i) => {
                const colors = ["bg-brand-500", "bg-brand-400", "bg-blue-400", "bg-amber-400", "bg-attention-500", "bg-red-500"];
                return (
                  <span key={b} className="inline-flex items-center gap-1">
                    <span className={`size-2 rounded-sm ${colors[i]}`} />
                    {b}
                  </span>
                );
              })}
            </div>
          </div>
        )}
      </section>

      <p className="text-[11px] text-ink-muted text-center pt-4">
        Reports refresh on every page load. <Link href="/api/settings/audit-export" className="text-brand-700 hover:underline">Export audit log</Link>.
      </p>
    </>
  );
}

function Empty({ msg }: { msg: string }) {
  return <div className="text-sm text-ink-muted py-8 text-center">{msg}</div>;
}

function formatCompact(n: number): string {
  if (!Number.isFinite(n)) return "—";
  if (n >= 10_000_000) return `${(n / 10_000_000).toFixed(1)}cr`;
  if (n >= 100_000) return `${(n / 100_000).toFixed(1)}L`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return n.toLocaleString();
}
