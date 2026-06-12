import Link from "next/link";
import { requireStaff } from "@/lib/rbac";
import { PageHeader, Badge, ListRow, StageBadge } from "@/components/primitives";
import { TimeAgo } from "@/components/time-ago";
import { getMyActionItems } from "@/lib/metrics";

export const dynamic = "force-dynamic";
export const metadata = { title: "Inbox" };

const MODE_LABEL: Record<string, string> = { video: "Video", phone: "Phone", onsite: "On-site" };

function fmtWhen(iso: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export default async function InboxPage() {
  const user = await requireStaff();
  const items = await getMyActionItems(Number(user.id));

  return (
    <>
      <PageHeader
        title="Inbox"
        subtitle="Everything across all jobs that needs you — scoped to you."
        actions={<Link href="/dashboard" className="btn-ghost">Dashboard</Link>}
      />

      {items.total === 0 ? (
        <div className="card p-8 flex items-center gap-3 bg-brand-50 border-brand-100">
          <span className="text-2xl">🎉</span>
          <div>
            <div className="text-sm font-semibold text-brand-900">Inbox zero</div>
            <div className="text-xs text-brand-700">No open tasks, idle candidates, stale submissions, or upcoming interviews.</div>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Upcoming interviews */}
          <Section title="Upcoming interviews" count={items.upcomingInterviews.length} hint="next 7 days">
            {items.upcomingInterviews.length === 0 ? (
              <Empty msg="No interviews in the next 7 days." />
            ) : (
              <ul className="divide-y divide-hairline">
                {items.upcomingInterviews.map((iv) => (
                  <li key={iv.id}>
                    <Link href={`/candidates/${iv.candidateId}`} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-canvas transition-colors">
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate">{iv.title}</div>
                        <div className="text-xs text-ink-soft">{fmtWhen(iv.scheduledStart)}</div>
                      </div>
                      <Badge tone="amber">{MODE_LABEL[iv.mode] || iv.mode}</Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          {/* My open tasks */}
          <Section title="My tasks" count={items.tasks.length}>
            {items.tasks.length === 0 ? (
              <Empty msg="No open tasks." />
            ) : (
              <ul className="divide-y divide-hairline">
                {items.tasks.map((t) => {
                  const overdue = t.dueAt && new Date(t.dueAt).getTime() < Date.now();
                  const inner = (
                    <div className="flex items-center justify-between gap-3 px-5 py-3">
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate">{t.title}</div>
                        {t.body && <div className="text-xs text-ink-soft truncate mt-0.5">{t.body}</div>}
                      </div>
                      {t.dueAt && (
                        <Badge tone={overdue ? "red" : "default"}>
                          {overdue ? "overdue" : "due"} <span className="ml-1"><TimeAgo date={new Date(t.dueAt)} /></span>
                        </Badge>
                      )}
                    </div>
                  );
                  return (
                    <li key={t.id}>
                      {t.candidateId ? (
                        <Link href={`/candidates/${t.candidateId}`} className="block hover:bg-canvas transition-colors">{inner}</Link>
                      ) : t.jobId ? (
                        <Link href={`/jobs/${t.jobId}`} className="block hover:bg-canvas transition-colors">{inner}</Link>
                      ) : (
                        inner
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </Section>

          {/* Submissions awaiting feedback */}
          <Section title="Awaiting client feedback" count={items.staleSubmissions.length} hint="sent >5 days ago">
            {items.staleSubmissions.length === 0 ? (
              <Empty msg="No submissions waiting on feedback." />
            ) : (
              <ul className="divide-y divide-hairline">
                {items.staleSubmissions.map((s) => (
                  <ListRow
                    key={s.id}
                    href={`/jobs/${s.jobId}`}
                    primary={s.candidateName}
                    secondary={<>Submitted to job #{s.jobId} · <TimeAgo date={new Date(s.createdAt)} /></>}
                    trailing={<Badge tone="amber">chase</Badge>}
                  />
                ))}
              </ul>
            )}
          </Section>

          {/* Idle candidates I own */}
          <Section title="My idle candidates" count={items.idleCandidates.length} hint="no movement in 14 days">
            {items.idleCandidates.length === 0 ? (
              <Empty msg="None of your candidates are stuck." />
            ) : (
              <ul className="divide-y divide-hairline">
                {items.idleCandidates.map((c) => (
                  <ListRow
                    key={c.id}
                    href={`/candidates/${c.id}`}
                    primary={c.fullName}
                    secondary={<>Idle since <TimeAgo date={new Date(c.updatedAt)} /></>}
                    trailing={<StageBadge stage={c.stage} />}
                  />
                ))}
              </ul>
            )}
          </Section>

          {items.unreadNotifications > 0 && (
            <Link href="/notifications" className="card p-4 flex items-center justify-between hover:bg-canvas transition-colors">
              <span className="text-sm font-medium">Unread notifications</span>
              <Badge tone="blue">{items.unreadNotifications}</Badge>
            </Link>
          )}
        </div>
      )}
    </>
  );
}

function Section({ title, count, hint, children }: { title: string; count: number; hint?: string; children: React.ReactNode }) {
  return (
    <section className="card overflow-hidden">
      <div className="px-5 py-4 border-b border-hairline flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">{title}</span>
          <Badge tone={count > 0 ? "blue" : "default"}>{count}</Badge>
        </div>
        {hint && <span className="text-xs text-ink-muted">{hint}</span>}
      </div>
      {children}
    </section>
  );
}

function Empty({ msg }: { msg: string }) {
  return <div className="px-5 py-8 text-center text-sm text-ink-muted">{msg}</div>;
}
