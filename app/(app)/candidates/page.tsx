import { desc, ilike, or, sql, count, and, eq, type SQL } from "drizzle-orm";
import Link from "next/link";
import { db } from "@/db";
import { candidates, vendorAccounts, savedViews, emailTemplates } from "@/db/schema";
import { requireStaffOrLite, isLite } from "@/lib/rbac";
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
  searchParams: Promise<{ q?: string; page?: string; stage?: string; tag?: string; blind?: string }>;
}) {
  const user = await requireStaffOrLite();
  const lite = isLite(user);
  const sp = await searchParams;
  const { q, page, pageSize, offset } = parseListParams(sp);
  const stage = sp.stage;
  const tag = sp.tag;
  const blind = sp.blind === "1";
  const [aiSearchEnabled, dedupeEnabled, talentPoolEnabled, bulkEmailEnabled] = await Promise.all([
    isFeatureEnabled("ai_search"),
    isFeatureEnabled("ai_dedupe"),
    isFeatureEnabled("talent_pool"),
    isFeatureEnabled("bulk_email"),
  ]);

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
  // Talent-pool filter: candidates carrying a given tag (jsonb array contains).
  if (tag) conditions.push(sql`${candidates.tags} @> ${JSON.stringify([tag])}::jsonb`);
  // hr_lite only ever sees candidates they uploaded.
  if (lite) conditions.push(sql`${candidates.uploadedById} = ${Number(user.id)}`);

  const whereExpr = conditions.length > 0 ? and(...conditions) : undefined;

  // Stage counts respect the q filter + lite ownership, but ignore the stage
  // filter (so pills show totals within the user's visible set).
  const stageCondsQ: SQL[] = [];
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
    if (orExpr) stageCondsQ.push(orExpr);
  }
  if (lite) stageCondsQ.push(sql`${candidates.uploadedById} = ${Number(user.id)}`);
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
  const emailTemplateList = bulkEmailEnabled
    ? await db.select({ slug: emailTemplates.slug, name: emailTemplates.name }).from(emailTemplates).where(eq(emailTemplates.isActive, true)).orderBy(emailTemplates.name)
    : [];

  const total = totalRows[0]?.n ?? 0;
  const stageCounts = new Map<string, number>();
  for (const r of stageCountRows) stageCounts.set(r.stage, r.n);
  const allStagesTotal = stageCountRows.reduce((s, r) => s + r.n, 0);

  const stageOptions = ["all", "received", "hr_review", "screening", "submitted", "shortlist", "interview", "hold", "offer", "joined", "rejected"];

  return (
    <>
      <PageHeader
        title="Candidates"
        subtitle={`${total} candidate${total === 1 ? "" : "s"}${q ? ` matching "${q}"` : ""}${tag ? ` tagged "${tag}"` : ""}`}
        actions={
          <>
            {!lite && (
              <Link
                href={blindHref({ q, stage, tag }, !blind)}
                className={`btn-ghost ${blind ? "bg-brand-50 text-brand-700 border-brand-100" : ""}`}
                title="Hide names & contact for unbiased screening"
              >
                {blind ? "Blind: on" : "Blind mode"}
              </Link>
            )}
            {!lite && aiSearchEnabled && <Link href="/candidates/ai-search" className="btn-ghost">✨ AI search</Link>}
            {!lite && talentPoolEnabled && <Link href="/candidates?tag=talent-pool" className="btn-ghost">Talent pool</Link>}
            {!lite && dedupeEnabled && <Link href="/candidates/duplicates" className="btn-ghost">Duplicates</Link>}
            {!lite && <Link href="/candidates/import" className="btn-ghost">Import CSV</Link>}
            <Link href="/candidates/upload" className="btn-primary">Upload resume</Link>
          </>
        }
      />

      <ListToolbar
        basePath="/candidates"
        placeholder="Search by name, email, title, location, skill, or ref id…"
      />

      {(q || stage || tag) && (
        <div className="flex items-center gap-1.5 flex-wrap mb-3 text-xs">
          <span className="text-ink-muted">Filters:</span>
          {q && <FilterChip label={`“${q}”`} removeHref={chipHref({ stage, tag })} />}
          {stage && <FilterChip label={`stage: ${stage.replaceAll("_", " ")}`} removeHref={chipHref({ q, tag })} />}
          {tag && <FilterChip label={`tag: ${tag}`} removeHref={chipHref({ q, stage })} />}
          <Link href="/candidates" className="text-brand-700 hover:underline ml-1">Clear all</Link>
        </div>
      )}

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
          <CandidatesTable rows={rows} isAdmin={user.role === "admin"} vendors={lite ? [] : vendorList} templates={lite ? [] : emailTemplateList} bulkEmailEnabled={!lite && bulkEmailEnabled} lite={lite} blind={blind} />
          <Pager basePath="/candidates" page={page} pageSize={pageSize} total={total} q={q} status={stage} />
        </>
      )}
    </>
  );
}

function chipHref(params: { q?: string; stage?: string; tag?: string }): string {
  const sp = new URLSearchParams();
  if (params.q) sp.set("q", params.q);
  if (params.stage) sp.set("stage", params.stage);
  if (params.tag) sp.set("tag", params.tag);
  return `/candidates${sp.toString() ? `?${sp}` : ""}`;
}

function blindHref(params: { q?: string; stage?: string; tag?: string }, on: boolean): string {
  const sp = new URLSearchParams();
  if (params.q) sp.set("q", params.q);
  if (params.stage) sp.set("stage", params.stage);
  if (params.tag) sp.set("tag", params.tag);
  if (on) sp.set("blind", "1");
  return `/candidates${sp.toString() ? `?${sp}` : ""}`;
}

function FilterChip({ label, removeHref }: { label: string; removeHref: string }) {
  return (
    <Link
      href={removeHref}
      className="inline-flex items-center gap-1 pl-2.5 pr-1.5 h-6 rounded-full bg-canvas border border-hairline text-ink-soft hover:text-ink hover:border-ink-muted transition-colors"
    >
      {label}
      <span className="text-ink-muted" aria-hidden>×</span>
    </Link>
  );
}
