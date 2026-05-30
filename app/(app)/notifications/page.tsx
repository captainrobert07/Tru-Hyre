import { eq, desc, isNull, and } from "drizzle-orm";
import Link from "next/link";
import { db } from "@/db";
import { notifications } from "@/db/schema";
import { requireUser } from "@/lib/rbac";
import { PageHeader, Badge, EmptyState } from "@/components/primitives";
import { TimeAgo } from "@/components/time-ago";
import { markReadAction, markAllReadAction } from "./actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Notifications" };

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const user = await requireUser();
  const { filter } = await searchParams;
  const showUnread = filter === "unread";

  const rows = await db
    .select()
    .from(notifications)
    .where(
      showUnread
        ? and(eq(notifications.userId, Number(user.id)), isNull(notifications.readAt))
        : eq(notifications.userId, Number(user.id)),
    )
    .orderBy(desc(notifications.createdAt))
    .limit(200);

  const unreadCount = rows.filter((r) => !r.readAt).length;

  return (
    <>
      <PageHeader
        title="Notifications"
        subtitle={`${unreadCount} unread`}
        actions={
          unreadCount > 0 ? (
            <form action={markAllReadAction}>
              <button type="submit" className="btn-ghost text-xs">Mark all read</button>
            </form>
          ) : undefined
        }
      />

      <div className="card mb-4 px-2 py-1.5 inline-flex gap-0.5">
        <Link
          href="/notifications"
          className={`text-xs px-3 h-8 rounded-md inline-flex items-center transition-colors ${
            !showUnread ? "bg-canvas text-ink shadow-card font-medium" : "text-ink-soft hover:text-ink"
          }`}
        >
          All
        </Link>
        <Link
          href="/notifications?filter=unread"
          className={`text-xs px-3 h-8 rounded-md inline-flex items-center transition-colors ${
            showUnread ? "bg-canvas text-ink shadow-card font-medium" : "text-ink-soft hover:text-ink"
          }`}
        >
          Unread
        </Link>
      </div>

      {rows.length === 0 ? (
        <EmptyState title={showUnread ? "Nothing unread" : "No notifications"} />
      ) : (
        <div className="card overflow-hidden divide-y divide-hairline">
          {rows.map((n) => (
            <NotificationRow key={n.id} n={n} />
          ))}
        </div>
      )}
    </>
  );
}

function NotificationRow({ n }: { n: typeof notifications.$inferSelect }) {
  const isUnread = !n.readAt;
  return (
    <div className={`px-4 py-3 flex items-start gap-3 ${isUnread ? "bg-brand-50/40" : ""}`}>
      <div className={`mt-1.5 size-2 shrink-0 rounded-full ${isUnread ? "bg-brand-500" : "bg-transparent"}`} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge tone="default" className="capitalize">{n.kind.replace("_", " ")}</Badge>
          <span className="text-sm font-medium">{n.title}</span>
          <span className="text-xs text-ink-muted ml-auto"><TimeAgo date={n.createdAt} /></span>
        </div>
        {n.body && <p className="text-xs text-ink-soft mt-1 line-clamp-2">{n.body}</p>}
        <div className="flex gap-2 mt-2">
          {n.url && (
            <Link href={n.url} className="text-xs text-brand-700 hover:underline">Open</Link>
          )}
          {isUnread && (
            <form action={markReadAction.bind(null, n.id)}>
              <button type="submit" className="text-xs text-ink-soft hover:text-ink">Mark read</button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
