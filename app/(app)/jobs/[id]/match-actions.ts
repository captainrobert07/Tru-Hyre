"use server";

import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/rbac";
import { assertFeatureEnabled } from "@/lib/features";
import { computeMatchScores, type MatchRow } from "@/lib/match";

export async function refreshMatchScoresAction(
  jobId: number,
): Promise<{ ok: boolean; error?: string; rows?: MatchRow[] }> {
  await requireStaff();
  await assertFeatureEnabled("ai_match");
  try {
    const rows = await computeMatchScores(jobId);
    revalidatePath(`/jobs/${jobId}`);
    return { ok: true, rows };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
