import { SkeletonHeader, Skeleton } from "@/components/skeleton";

/**
 * Route-level loading UI for the client detail page. Completes detail-route
 * loading coverage (candidates/[id] and jobs/[id] already have one). Mirrors
 * the page's header + 3-column section grid (profile / jobs / contacts) so the
 * skeleton-to-content swap doesn't jump.
 */
export default function Loading() {
  return (
    <>
      <SkeletonHeader />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Skeleton className="card h-48" />
        <Skeleton className="card h-48" />
        <Skeleton className="card h-48" />
      </div>
    </>
  );
}
