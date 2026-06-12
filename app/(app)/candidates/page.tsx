import { desc, ilike, or, sql, count, and, eq, type SQL } from "drizzle-orm";
import Link from "next/link";
import { db } from "@/db";
import { candidates, vendorAccounts, savedViews } from "@/db/schema";
import { requireStaff } from "@/lib/rbac";
import { isFeatureEnabled } from "@/lib/features";
import { parseListParams } from "@/lib/list-params";
import { PageHeader, EmptyState } from "@/components/primitives";
import { ListToolbar, Pager } from "@/components/list-toolbar";
import { CandidatesTable } from "./candidates-table";
import { SavedViews } from "@/components/saved-views";
import { createSavedViewAction, deleteSavedViewAction } from "./saved-view-actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Candidates" };

export default async function CandidatesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string; stage?: string }>;
}) {
  const user = await requireStaff();
  const sp = await searchParams;
  const { q, page, pageSize, offset } = parseListParams(sp);
  const stage = sp.stage;
  const aiSearchEnabled = await isFeatureEnabled("ai_search");
  const dedupeEnabled = await isFeatureEnabled("ai_dedupe");

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

  // Stage counts respect the q filter but ignore the stage filter (so the
  // pills show "all" totals, not just the currently-selected stage).
  const stageCondsQ: SQL[] = q ? [conditions[0]!] : [];
  const stageWhere = stageCondsQ.length > 0 ? and(...stageCondsQ) : undefined;

  const [rows, totalRows, vendorList, mySavedViews, stageCountRows] = await Promise.all([
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
    db.select({ id: vendorAccounts.id, name: vendorAccounts.name }).from(vendorAccounts).orderBy(vendorAccounts.name),
    db
      .select({ id: savedViews.id, name: savedViews.name, query: savedViews.query, pinned: savedViews.pinned })
      .from(savedViews)
      .where(and(eq(savedViews.userId, Number(user.id)), eq(savedViews.scope, "candidates"), eq(savedViews.pinned, true)))
      .orderBy(savedViews.sortOrder, savedViews.createdAt),
    db
      .select({ stage: candidates.stage, n: count() })
      .from(candidates)
      .where(stageWhere)
      .groupBy(candidates.stage),
  ]);
  const total = totalRows[0]?.n ?? 0;
  const stageCounts = new Map<string, number>();
  for (const r of stageCountRows) stageCounts.set(r.stage, r.n);
  const allStagesTotal = stageCountRows.reduce((s, r) => s + r.n, 0);

  const stageOptions = ["all", "received", "hr_review", "screening", "submitted", "shortlist", "interview", "hold", "offer", "joined", "rejected"];

  return (
    <>
      <PageHeader
        title="Candidates"
        subtitle={`${total} candidate${total === 1 ? "" : "s"}${q ? ` matching "${q}"` : ""}`}
        actions={
          <>
            {aiSearchEnabled && <Link href="/candidates/ai-search" className="btn-ghost">✨ AI search</Link>}
            {dedupeEnabled && <Link href="/candidates/duplicates" className="btn-ghost">Duplicates</Link>}
            <Link href="/candidates/import" className="btn-ghost">Import CSV</Link>
            <Link href="/candidates/upload" className="btn-primary">Upload resume</Link>
          </>
        }
      />

      <ListToolbar
        basePath="/candidates"
        placeholder="Search by name, email, title, location, skill, or ref id…"
      />

      <SavedViews
        scope="candidates"
        basePath="/candidates"
        views={mySavedViews}
        onCreate={async (input) => {
          "use server";
          return await createSavedViewAction(input);
        }}
        onDelete={async (id) => {
          "use server";
          await deleteSavedViewAction(id);
        }}
      />

      <div className="flex flex-wrap gap-1 mb-3">
        {stageOptions.map((s) => {
          const active = (stage || "all") === s;
          const n = s === "all" ? allStagesTotal : (stageCounts.get(s) || 0);
          const params = new URLSearchParams();
          if (q) params.set("q", q);
          if (s !== "all") params.set("stage", s);
          const href = `/candidates${params.toString() ? `?${params}` : ""}`;
          return (
            <Link
              key={s}
              href={href}
              className={`text-[11px] px-2.5 h-7 rounded-full inline-flex items-center gap-1.5 transition-colors ${
                active ? "bg-ink_inverted text-white" : "bg-canvas text-ink-soft hover:text-ink"
              } ${n === 0 && s !== "all" && !active ? "opacity-50" : ""}`}
            >
              <span>{s === "all" ? "All" : s.replaceAll("_", " ")}</span>
              <span
                className={`tabular-nums text-[10px] font-medium px-1 rounded ${
                  active ? "bg-white/15" : "bg-surface text-ink-muted"
                }`}
              >
                {n}
              </span>
            </Link>
          );
        })}
      </div>

      {rows.length === 0 ? (
        <EmptyState
          title={q || stage ? "No matches" : "No candidates yet"}
          description={q || stage ? "Try a different filter or search." : "Upload your first PDF resume — Tru Hyre will parse, dedupe, and stage it for review."}
          cta={!q && !stage ? { href: "/candidates/upload", label: "Upload resume" } : undefined}
        />
      ) : (
        <>
          <CandidatesTable rows={rows} isAdmin={user.role === "admin"} vendors={vendorList} />
          <Pager basePath="/candidates" page={page} pageSize={pageSize} total={total} q={q} status={stage} />
        </>
      )}
    </>
  );
}
