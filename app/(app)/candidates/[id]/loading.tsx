import { SkeletonHeader, SkeletonStatGrid, Skeleton } from "@/components/skeleton";

export default function Loading() {
  return (
    <>
      <SkeletonHeader />
      <SkeletonStatGrid count={4} />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <Skeleton className="card h-72" />
          <Skeleton className="card h-40" />
        </div>
        <div className="space-y-4">
          <Skeleton className="card h-32" />
          <Skeleton className="card h-32" />
          <Skeleton className="card h-40" />
        </div>
      </div>
    </>
  );
}
