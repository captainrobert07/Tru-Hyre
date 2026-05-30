import { desc, ilike, or, sql, count, and, type SQL } from "drizzle-orm";
import Link from "next/link";
import { db } from "@/db";
import { candidates } from "@/db/schema";
import { requireStaff } from "@/lib/rbac";
import { parseListParams } from "@/lib/list-params";
import { PageHeader, ListRow, StageBadge, EmptyState } from "@/components/primitives";
import { ListToolbar, Pager } from "@/components/list-toolbar";

export const dynamic = "force-dynamic";
export const metadata = { title: "Candidates" };

export default async function CandidatesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string; stage?: string }>;
}) {
  await requireStaff();
  const sp = await searchParams;
  const { q, page, pageSize, offset } = parseListParams(sp);
  const stage = sp.stage;

  const conditions: SQL[] = [];
  if (q) {
    const like = `%${q}%`;
    const orExpr = or(
      ilike(candidates.fullName, like),
      ilike(candidates.email, like),
      ilike(candidates.currentTitle, like),
      ilike(candidates.location, like),
      sql`${candidates.skills}::text ilike ${like}`,
      ilike(candidates.refId, like),
    );
    if (orExpr) conditions.push(orExpr);
  }
  if (stage) conditions.push(sql`${candidates.stage} = ${stage}`);

  const whereExpr = conditions.length > 0 ? and(...conditions) : undefined;

  const [rows, totalRows] = await Promise.all([
    db
      .select({
        id: candidates.id,
        fullName: candidates.fullName,
        currentTitle: candidates.currentTitle,
        location: candidates.location,
        experienceYears: candidates.experienceYears,
        stage: candidates.stage,
        refId: candidates.refId,
      })
      .from(candidates)
      .where(whereExpr)
      .orderBy(desc(candidates.createdAt))
      .limit(pageSize)
      .offset(offset),
    db.select({ n: count() }).from(candidates).where(whereExpr),
  ]);
  const total = totalRows[0]?.n ?? 0;

  const stageOptions = ["all", "received", "hr_review", "screening", "submitted", "shortlist", "interview", "hold", "offer", "joined", "rejected"];

  return (
    <>
      <PageHeader
        title="Candidates"
        subtitle={`${total} candidate${total === 1 ? "" : "s"}${q ? ` matching "${q}"` : ""}`}
        actions={<Link href="/candidates/upload" className="btn-primary">Upload resume</Link>}
      />

      <ListToolbar
        basePath="/candidates"
        placeholder="Search by name, email, title, location, skill, or ref id…"
        extra={
          <div className="flex flex-wrap gap-1">
            {stageOptions.map((s) => {
              const active = (stage || "all") === s;
              const params = new URLSearchParams();
              if (q) params.set("q", q);
              if (s !== "all") params.set("stage", s);
              const href = `/candidates${params.toString() ? `?${params}` : ""}`;
              return (
                <Link
                  key={s}
                  href={href}
                  className={`text-xs px-3 h-9 rounded-full inline-flex items-center transition-colors ${
                    active ? "bg-ink_inverted text-white" : "bg-canvas text-ink-soft hover:text-ink"
                  }`}
                >
                  {s === "all" ? "All" : s.replaceAll("_", " ")}
                </Link>
              );
            })}
          </div>
        }
      />

      {rows.length === 0 ? (
        <EmptyState
          title={q || stage ? "No matches" : "No candidates yet"}
          description={q || stage ? "Try a different filter or search." : "Upload your first PDF resume — Tru Hyre will parse, dedupe, and stage it for review."}
          cta={!q && !stage ? { href: "/candidates/upload", label: "Upload resume" } : undefined}
        />
      ) : (
        <>
          <div className="card overflow-hidden divide-y divide-hairline">
            {rows.map((c) => (
              <ListRow
                key={c.id}
                href={`/candidates/${c.id}`}
                primary={
                  <span className="flex items-center gap-2">
                    {c.fullName}
                    <span className="text-[10px] text-ink-muted font-mono">{c.refId}</span>
                  </span>
                }
                secondary={[c.currentTitle, c.location, c.experienceYears ? `${c.experienceYears} yrs` : null]
                  .filter(Boolean)
                  .join(" · ")}
                trailing={<StageBadge stage={c.stage} />}
              />
            ))}
          </div>
          <Pager basePath="/candidates" page={page} pageSize={pageSize} total={total} q={q} status={stage} />
        </>
      )}
    </>
  );
}
