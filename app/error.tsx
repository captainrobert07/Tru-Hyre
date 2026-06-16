"use client";

import Link from "next/link";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="login-bg min-h-screen flex items-center justify-center px-4">
      <div className="card max-w-md w-full p-8 space-y-3">
        <h1 className="text-xl font-semibold">Something went wrong</h1>
        <p className="text-sm text-ink-soft">An unexpected error occurred. Try again, or sign in fresh.</p>
        {/* Show only the digest, never the raw error.message. Next scrubs
            server-error messages in prod (digest is the correlation key), but
            client-side errors pass their real message through — painting that
            into the UI leaks internals and looks unprofessional. The digest
            maps to the full stack in the Vercel logs (instrumentation.ts). */}
        {error.digest && (
          <div className="text-[10px] font-mono text-ink-muted bg-canvas border border-hairline rounded-lg p-2">
            Reference: {error.digest}
          </div>
        )}
        <div className="flex gap-2 pt-2">
          <button onClick={reset} className="btn-primary text-sm">Try again</button>
          <Link href="/login" className="btn-ghost text-sm">Sign in</Link>
        </div>
      </div>
    </main>
  );
}
