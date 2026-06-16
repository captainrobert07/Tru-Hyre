import Link from "next/link";
import { APP_NAME } from "@/lib/utils";

/**
 * App-wide custom 404. ~20 `notFound()` call sites (stale candidate/job links,
 * closed careers reqs, flag-off routes, RBAC bounces) previously rendered Next's
 * bare unstyled default — jarring in an otherwise fully-designed internal tool.
 * This matches the error.tsx / invite Shell card pattern (login-bg + card) and
 * gives a way back.
 *
 * NOTE: the copy intentionally keeps the phrase "could not be found" — two E2E
 * specs (hr-lite-isolation, careers-not-found) assert that text as the
 * notFound() contract; keeping it means this brand upgrade doesn't break the
 * regression locks.
 */
export default function NotFound() {
  return (
    <main className="login-bg min-h-screen flex items-center justify-center px-4 py-10">
      <div className="card w-full max-w-md p-8 text-center space-y-3">
        <div className="text-[11px] font-mono uppercase tracking-wide text-ink-muted">404</div>
        <h1 className="text-xl font-semibold tracking-tight">This page could not be found</h1>
        <p className="text-sm text-ink-soft">
          The link may be stale, the record may have moved, or you may not have access to it.
        </p>
        <div className="flex gap-2 justify-center pt-2">
          <Link href="/dashboard" className="btn-primary text-sm">Back to {APP_NAME}</Link>
          <Link href="/candidates" className="btn-ghost text-sm">Candidates</Link>
        </div>
      </div>
    </main>
  );
}
