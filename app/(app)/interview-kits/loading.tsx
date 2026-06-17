import { SkeletonHeader, Skeleton } from "@/components/skeleton";

// Nav-time skeleton for the interview-kits page (6 awaits: requireStaff,
// feature flag, kits + jobs queries) — previously showed a blank screen on
// navigation. Mirrors the real layout: PageHeader + a "new kit" trigger row +
// the 2-col grid of kit cards (InterviewKitManager's grid-cols-1 md:grid-cols-2).
export default function Loading() {
  return (
    <>
      <SkeletonHeader />
      <Skeleton className="card h-11 w-40 mb-4" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="card h-36" />
        ))}
      </div>
    </>
  );
}
