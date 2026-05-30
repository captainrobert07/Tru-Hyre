import { SkeletonHeader, SkeletonList } from "@/components/skeleton";

export default function Loading() {
  return (
    <>
      <SkeletonHeader />
      <SkeletonList rows={8} />
    </>
  );
}
