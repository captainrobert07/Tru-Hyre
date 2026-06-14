import { SkeletonHeader, SkeletonStatGrid, Skeleton } from "@/components/skeleton";

/**
 * Route-level loading UI for the job detail page. It runs ~12 server queries
 * (job, submissions, vendors, match scores, …) so without this the user saw a
 * blank screen on navigation. Mirrors the page's real layout — header, 4-stat
 * grid, 2-col (pipeline list + sidebar) — so the skeleton doesn't jump on swap.
 * Matches the established pattern in candidates/[id]/loading.tsx.
 */
export default function Loading() {
  return (
    <>
      <SkeletonHeader />
      <SkeletonStatGrid count={4} />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <Skeleton className="card h-64" />
          <Skeleton className="card h-40" />
        </div>
        <div className="space-y-4">
          <Skeleton className="card h-40" />
          <Skeleton className="card h-32" />
        </div>
      </div>
    </>
  );
}
