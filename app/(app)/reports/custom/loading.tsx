import { SkeletonHeader, Skeleton } from "@/components/skeleton";

/**
 * Route-level loading UI for the custom report builder. The page resolves saved
 * report definitions + (when a metric is selected) runs a measure query before
 * render. Mirrors its layout — header, filter-form card, results-table card —
 * so navigation shows structure instead of a blank screen.
 */
export default function Loading() {
  return (
    <>
      <SkeletonHeader />
      <Skeleton className="card h-20 mb-4" />
      <Skeleton className="card h-64 mb-4" />
      <Skeleton className="card h-20" />
    </>
  );
}
