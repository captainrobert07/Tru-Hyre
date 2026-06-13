import { SkeletonHeader, SkeletonStatGrid, Skeleton } from "@/components/skeleton";

export default function Loading() {
  return (
    <>
      <SkeletonHeader />
      <SkeletonStatGrid count={4} />
      <Skeleton className="card h-44 mb-6" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <Skeleton className="card h-64" />
        <Skeleton className="card h-64" />
      </div>
      <Skeleton className="card h-56" />
    </>
  );
}
