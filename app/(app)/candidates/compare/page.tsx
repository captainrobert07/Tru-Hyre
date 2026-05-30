import Link from "next/link";
import { inArray } from "drizzle-orm";
import { db } from "@/db";
import { candidates } from "@/db/schema";
import { requireStaff } from "@/lib/rbac";
import { PageHeader, Badge, StageBadge, EmptyState } from "@/components/primitives";

export const dynamic = "force-dynamic";
export const metadata = { title: "Compare candidates" };

function fmtMoney(v: string | null) {
  if (!v) return "—";
  const n = Number(v);
  if (Number.isNaN(n)) return v;
  if (n >= 10_000_000) return `${(n / 10_000_000).toFixed(1)}cr`;
  if (n >= 100_000) return `${(n / 100_000).toFixed(1)}L`;
  return n.toLocaleString("en-IN");
}

export default async function ComparePage({ searchParams }: { searchParams: Promise<{ ids?: string }> }) {
  await requireStaff();
  const sp = await searchParams;
  const ids = (sp.ids || "")
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n) && n > 0)
    .slice(0, 4);

  if (ids.length < 2) {
    return (
      <>
        <PageHeader title="Compare candidates" subtitle="Pick at least 2 candidates to compare side-by-side." />
        <EmptyState
          title="Nothing to compare yet"
          description="Open Candidates, multi-select 2-4 rows, then click 'Compare'."
          cta={{ href: "/candidates", label: "Pick candidates →" }}
        />
      </>
    );
  }

  const rows = await db.select().from(candidates).where(inArray(candidates.id, ids));
  // Preserve the URL order
  const ordered = ids.map((id) => rows.find((r) => r.id === id)).filter(Boolean) as typeof rows;

  if (ordered.length === 0) {
    return (
      <>
        <PageHeader title="Compare candidates" />
        <EmptyState title="None of these candidates exist" />
      </>
    );
  }

  type Field = { label: string; render: (c: typeof ordered[number]) => React.ReactNode };
  const FIELDS: Field[] = [
    { label: "Stage", render: (c) => <StageBadge stage={c.stage} /> },
    { label: "Title", render: (c) => c.currentTitle || "—" },
    { label: "Company", render: (c) => c.currentCompany || "—" },
    { label: "Location", render: (c) => c.location || "—" },
    { label: "Experience", render: (c) => c.experienceYears ? `${c.experienceYears} yrs` : "—" },
    { label: "Notice", render: (c) => c.noticePeriodDays !== null ? `${c.noticePeriodDays} days` : "—" },
    { label: "Current CTC", render: (c) => fmtMoney(c.currentCtc) },
    { label: "Expected CTC", render: (c) => fmtMoney(c.expectedCtc) },
    { label: "Available from", render: (c) => c.availableFrom || "—" },
    { label: "Relocate", render: (c) => c.willingToRelocate === null ? "—" : c.willingToRelocate ? "Yes" : "No" },
    { label: "Work auth", render: (c) => c.workAuthorization || "—" },
    {
      label: "Skills",
      render: (c) => c.skills && c.skills.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {c.skills.slice(0, 12).map((s) => <Badge key={s} tone="green" className="text-[10px] h-5">{s}</Badge>)}
          {c.skills.length > 12 && <span className="text-[10px] text-ink-muted">+{c.skills.length - 12}</span>}
        </div>
      ) : "—",
    },
    {
      label: "LinkedIn",
      render: (c) => c.linkedinUrl ? (
        <a href={c.linkedinUrl} target="_blank" rel="noopener noreferrer" className="text-brand-700 text-xs hover:underline truncate inline-block max-w-full">View</a>
      ) : "—",
    },
    {
      label: "GitHub",
      render: (c) => c.githubUrl ? (
        <a href={c.githubUrl} target="_blank" rel="noopener noreferrer" className="text-brand-700 text-xs hover:underline truncate inline-block max-w-full">View</a>
      ) : "—",
    },
    {
      label: "Summary",
      render: (c) => c.summary ? <span className="text-xs text-ink-soft line-clamp-4">{c.summary}</span> : "—",
    },
  ];

  return (
    <>
      <PageHeader
        title="Compare"
        subtitle={`${ordered.length} candidates`}
        actions={<Link href="/candidates" className="btn-ghost">← Back to candidates</Link>}
      />

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-hairline">
              <th className="sticky left-0 bg-surface text-left text-[11px] uppercase tracking-wide text-ink-muted px-4 py-3 w-32">Field</th>
              {ordered.map((c) => (
                <th key={c.id} className="text-left p-3 align-top min-w-[220px]">
                  <Link href={`/candidates/${c.id}`} className="block group">
                    <div className="font-semibold text-base group-hover:text-brand-700 truncate">{c.fullName}</div>
                    <div className="text-[10px] font-mono text-ink-muted truncate">{c.refId}</div>
                  </Link>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-hairline">
            {FIELDS.map((f) => (
              <tr key={f.label} className="hover:bg-canvas/40">
                <td className="sticky left-0 bg-surface text-[11px] uppercase tracking-wide text-ink-muted px-4 py-2.5 align-top">{f.label}</td>
                {ordered.map((c) => (
                  <td key={c.id} className="px-3 py-2.5 align-top">{f.render(c)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
