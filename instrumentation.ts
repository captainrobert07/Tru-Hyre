/**
 * Next.js instrumentation hook. The `onRequestError` export fires for every
 * uncaught server-side error — including Server Component render throws that
 * production normally hides behind a hashed `digest`. We log the REAL error,
 * stack, route, and the digest so the two can be correlated in Vercel logs.
 *
 * Why this exists: a production render crash surfaced only as
 * "Something went wrong / digest: 3495001251" with no readable message
 * (Next strips server error text in prod). The runtime-log API is gated on
 * the current token tier, so the stack was unreachable. This hook writes the
 * stack to stdout, which Vercel captures regardless of tier. Find the matching
 * `digest` in the logs and you have the exact file:line and the request that
 * triggered it.
 *
 * Cost: zero on the happy path (only runs on an actual error). No deps.
 */

import { type Instrumentation } from "next";

export const onRequestError: Instrumentation.onRequestError = async (
  error,
  request,
  context,
) => {
  const err = error as Error & { digest?: string };

  // Single structured line so it's greppable in Vercel logs by digest.
  console.error(
    "[onRequestError]",
    JSON.stringify({
      digest: err?.digest ?? null,
      name: err?.name ?? null,
      message: err?.message ?? String(error),
      // Path the user hit + the matched route template (e.g. /jobs/[id]).
      path: request?.path,
      method: request?.method,
      routePath: context?.routePath,
      routeType: context?.routeType,
      routerKind: context?.routerKind,
      renderSource: context?.renderSource,
      renderType: context?.renderType,
    }),
  );
  // Full stack on its own lines — this is the part the digest was hiding.
  if (err?.stack) console.error("[onRequestError] stack:\n" + err.stack);
};
