import { redirect } from "next/navigation";
import Link from "next/link";
import { requireStaff } from "@/lib/rbac";
import { isFeatureEnabled } from "@/lib/features";
import { PageHeader, Badge } from "@/components/primitives";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { scanDuplicates } from "@/lib/dup-scan";

export const dynamic = "force-dynamic";
export const metadata = { title: "Duplicate candidates" };

const REASON_LABEL: Record<string, string> = {
  email: "Same email",
  phone: "Same phone",
  name: "Same name",
};

export default async function DuplicatesPage() {
  await requireStaff();
  if (!(await isFeatureEnabled("ai_dedupe"))) redirect("/candidates");

  const pairs = await scanDuplicates(100);

  return (
    <>
      <Breadcrumbs
        crumbs={[
          { href: "/dashboard", label: "Dashboard" },
          { href: "/candidates", label: "Candidates" },
          { label: "Duplicates" },
        ]}
      />
      <PageHeader
        title="Possible duplicates"
        subtitle={`${pairs.length} candidate pair${pairs.length === 1 ? "" : "s"} that may be the same person. Review and merge manually — nothing is auto-deleted.`}
      />

      {pairs.length === 0 ? (
        <div className="card p-8 text-center text-sm text-ink-muted">No likely duplicates found. 🎉</div>
      ) : (
        <div className="space-y-2">
          {pairs.map((p) => (
            <div key={`${p.a.id}-${p.b.id}`} className="card p-4">
              <div className="flex items-center gap-2 mb-2">
                <Badge tone={p.reason === "email" ? "red" : p.reason === "phone" ? "amber" : "default"}>
                  {REASON_LABEL[p.reason]}
                </Badge>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[p.a, p.b].map((c) => (
                  <Link
                    key={c.id}
                    href={`/candidates/${c.id}`}
                    className="rounded-lg border border-hairline p-3 hover:bg-canvas transition-colors"
                  >
                    <div className="text-sm font-medium truncate">{c.fullName}</div>
                    <div className="text-xs text-ink-soft truncate">{c.email || "no email"}</div>
                    <div className="text-[11px] text-ink-muted mt-1">
                      added {new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short", year: "numeric" }).format(new Date(c.createdAt))}
                    </div>
                  </Link>
                ))}
              </div>
              <p className="text-[11px] text-ink-muted mt-2">
                To merge: open both, copy anything worth keeping into the record you&apos;re keeping, then delete the other (admin → Danger zone).
              </p>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
