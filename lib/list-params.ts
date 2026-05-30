/** Shared parser for ?q=&page= on every list page. */

export type ListParams = {
  q: string;
  page: number;
  pageSize: number;
  offset: number;
};

export function parseListParams(
  raw: { q?: string; page?: string },
  pageSize = 50,
): ListParams {
  const q = (raw.q ?? "").toString().trim().slice(0, 200);
  const pageNum = Math.max(1, Math.floor(Number(raw.page ?? 1) || 1));
  return {
    q,
    page: pageNum,
    pageSize,
    offset: (pageNum - 1) * pageSize,
  };
}

/** Build a URLSearchParams while skipping empty values. */
export function listSearch(input: Record<string, string | number | undefined | null>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(input)) {
    if (v === undefined || v === null || v === "") continue;
    sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}
