import { SkeletonHeader, SkeletonStatGrid, SkeletonList, Skeleton } from "@/components/skeleton";

export default function Loading() {
  return (
    <>
      <SkeletonHeader />
      <SkeletonStatGrid count={4} />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        <Skeleton className="card lg:col-span-2 h-56" />
        <Skeleton className="card h-56" />
      </div>
      <SkeletonList rows={6} />
    </>
  );
}
