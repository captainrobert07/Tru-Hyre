import { SkeletonHeader, Skeleton } from "@/components/skeleton";

/**
 * Route-level loading UI for the vendor detail page. Completes detail-route
 * loading coverage. Mirrors the page's header + 2-column section grid (profile /
 * assigned jobs, with a full-width submissions section below).
 */
export default function Loading() {
  return (
    <>
      <SkeletonHeader />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Skeleton className="card h-44" />
        <Skeleton className="card h-44" />
        <Skeleton className="card h-56 lg:col-span-2" />
      </div>
    </>
  );
}
