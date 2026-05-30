import { sql, count, eq, desc } from "drizzle-orm";
import { db } from "@/db";
import { candidates, submissions, vendorAccounts } from "@/db/schema";
import { requireStaff } from "@/lib/rbac";
import { PageHeader, StatCard, Badge } from "@/components/primitives";

export const dynamic = "force-dynamic";
export const metadata = { title: "Reports" };

export default async function ReportsPage() {
  await requireStaff();

  const [candTotal, candByStage, subByStatus, vendorQuality, daily] = await Promise.all([
    db.select({ n: count() }).from(candidates),
    db
      .select({ stage: candidates.stage, n: count() })
      .from(candidates)
      .groupBy(candidates.stage),
    db
      .select({ status: submissions.status, n: count() })
      .from(submissions)
      .groupBy(submissions.status),
    db
      .select({
        vendorId: vendorAccounts.id,
        vendorName: vendorAccounts.name,
        candCount: count(candidates.id),
      })
      .from(vendorAccounts)
      .leftJoin(candidates, eq(candidates.vendorAccountId, vendorAccounts.id))
      .groupBy(vendorAccounts.id)
      .orderBy(desc(count(candidates.id)))
      .limit(20),
    db.execute(sql`
      SELECT to_char(date_trunc('day', created_at), 'YYYY-MM-DD') AS day, COUNT(*)::int AS n
      FROM ${candidates}
      WHERE created_at >= now() - interval '30 days'
      GROUP BY 1
      ORDER BY 1 ASC
    `),
  ]);

  const totalCands = candTotal[0]?.n ?? 0;
  const totalSubs = subByStatus.reduce((s, r) => s + Number(r.n), 0);
  const shortlisted = subByStatus.find((r) => r.status === "shortlist")?.n ?? 0;
  const offered = (subByStatus.find((r) => r.status === "offer")?.n ?? 0) + (subByStatus.find((r) => r.status === "joined")?.n ?? 0);
  const rejected = subByStatus.find((r) => r.status === "reject")?.n ?? 0;

  const submitRate = totalCands > 0 ? Math.round((totalSubs / totalCands) * 100) : 0;
  const shortlistRate = totalSubs > 0 ? Math.round((Number(shortlisted) / totalSubs) * 100) : 0;
  const offerRate = totalSubs > 0 ? Math.round((Number(offered) / totalSubs) * 100) : 0;

  const dailyRows = (daily.rows || daily) as Array<{ day: string; n: number }>;
  const maxDaily = Math.max(1, ...dailyRows.map((r) => r.n));

  return (
    <>
      <PageHeader title="Reports" subtitle="Pipeline conversion, vendor quality, daily volume." />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <StatCard label="Candidates" value={totalCands} />
        <StatCard label="Submissions" value={totalSubs} />
        <StatCard label="Submit rate" value={`${submitRate}%`} hint="cands → submitted" />
        <StatCard label="Offer rate" value={`${offerRate}%`} hint="of submissions" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <section className="card p-4">
          <h2 className="text-sm font-semibold mb-3">Conversion ratios</h2>
          <Row label="Candidate → Submitted" value={`${submitRate}%`} />
          <Row label="Submission → Shortlisted" value={`${shortlistRate}%`} />
          <Row label="Submission → Offer/Joined" value={`${offerRate}%`} />
          <Row label="Submission → Rejected" value={`${totalSubs > 0 ? Math.round((Number(rejected) / totalSubs) * 100) : 0}%`} />
        </section>

        <section className="card p-4">
          <h2 className="text-sm font-semibold mb-3">Pipeline by stage</h2>
          <ul className="space-y-1.5">
            {candByStage.map((r) => (
              <li key={r.stage} className="flex items-center justify-between text-sm">
                <span className="capitalize text-ink-soft">{r.stage.replace("_", " ")}</span>
                <span className="tabular-nums font-medium">{r.n}</span>
              </li>
            ))}
            {candByStage.length === 0 && <li className="text-sm text-ink-muted">No data.</li>}
          </ul>
        </section>

        <section className="card p-4">
          <h2 className="text-sm font-semibold mb-3">Submissions by status</h2>
          <ul className="space-y-1.5">
            {subByStatus.map((r) => (
              <li key={r.status} className="flex items-center justify-between text-sm">
                <span className="capitalize text-ink-soft">{r.status}</span>
                <span className="tabular-nums font-medium">{r.n}</span>
              </li>
            ))}
            {subByStatus.length === 0 && <li className="text-sm text-ink-muted">No data.</li>}
          </ul>
        </section>
      </div>

      <section className="card p-4 mb-6">
        <h2 className="text-sm font-semibold mb-3">Vendor quality</h2>
        {vendorQuality.length === 0 ? (
          <div className="text-sm text-ink-muted">No vendors yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-xs text-ink-muted uppercase tracking-wide">
              <tr>
                <th className="text-left font-medium pb-2">Vendor</th>
                <th className="text-right font-medium pb-2">Candidates</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline">
              {vendorQuality.map((v) => (
                <tr key={v.vendorId}>
                  <td className="py-2">{v.vendorName}</td>
                  <td className="py-2 text-right tabular-nums">{v.candCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="card p-4">
        <h2 className="text-sm font-semibold mb-3">Resume volume — last 30 days</h2>
        {dailyRows.length === 0 ? (
          <div className="text-sm text-ink-muted">No uploads in the last 30 days.</div>
        ) : (
          <div className="flex items-end gap-1 h-24 w-full">
            {dailyRows.map((r) => (
              <div
                key={r.day}
                className="flex-1 min-w-[6px] bg-gradient-to-b from-brand-500 to-brand-700 rounded-sm"
                style={{ height: `max(2px, ${(r.n / maxDaily) * 100}%)` }}
                title={`${r.day}: ${r.n}`}
              />
            ))}
          </div>
        )}
        <div className="text-[10px] text-ink-muted mt-2 flex justify-between">
          <span>{dailyRows[0]?.day || ""}</span>
          <span>peak {maxDaily}</span>
          <span>{dailyRows[dailyRows.length - 1]?.day || ""}</span>
        </div>
      </section>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1.5 text-sm">
      <span className="text-ink-soft">{label}</span>
      <Badge tone="blue" className="tabular-nums">{value}</Badge>
    </div>
  );
}
