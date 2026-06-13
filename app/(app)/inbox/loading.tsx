import { SkeletonHeader, SkeletonList } from "@/components/skeleton";

export default function Loading() {
  return (
    <>
      <SkeletonHeader />
      <div className="space-y-4">
        <SkeletonList rows={3} />
        <SkeletonList rows={3} />
      </div>
    </>
  );
}
