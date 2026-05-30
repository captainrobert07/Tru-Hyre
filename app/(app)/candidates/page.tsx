import { desc } from "drizzle-orm";
import Link from "next/link";
import { db } from "@/db";
import { candidates } from "@/db/schema";
import { requireStaff } from "@/lib/rbac";
import { PageHeader, ListRow, StageBadge, EmptyState } from "@/components/primitives";

export const dynamic = "force-dynamic";
export const metadata = { title: "Candidates" };

export default async function CandidatesPage() {
  await requireStaff();
  const rows = await db
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
    .orderBy(desc(candidates.createdAt))
    .limit(200);

  return (
    <>
      <PageHeader
        title="Candidates"
        subtitle={`${rows.length} candidate${rows.length === 1 ? "" : "s"}`}
        actions={<Link href="/candidates/upload" className="btn-primary">Upload resume</Link>}
      />

      {rows.length === 0 ? (
        <EmptyState
          title="No candidates yet"
          description="Upload your first PDF resume — Tru Hyre will parse, dedupe, and stage it for review."
          cta={{ href: "/candidates/upload", label: "Upload resume" }}
        />
      ) : (
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
      )}
    </>
  );
}
