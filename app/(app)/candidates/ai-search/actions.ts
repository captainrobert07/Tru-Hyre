"use server";

import { requireStaff } from "@/lib/rbac";
import { assertFeatureEnabled } from "@/lib/features";
import { semanticSearch, type SearchResult } from "@/lib/semantic-search";

export async function aiSearchAction(
  query: string,
): Promise<{ ok: boolean; result?: SearchResult; error?: string }> {
  await requireStaff();
  await assertFeatureEnabled("ai_search");
  const q = (query || "").trim();
  if (q.length < 3) return { ok: false, error: "Type at least a few words." };
  try {
    const result = await semanticSearch(q);
    return { ok: true, result };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
