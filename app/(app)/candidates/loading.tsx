import { SkeletonHeader, SkeletonList, Skeleton } from "@/components/skeleton";

export default function Loading() {
  return (
    <>
      <SkeletonHeader />
      <Skeleton className="card h-12 mb-4" />
      <SkeletonList rows={8} />
    </>
  );
}
