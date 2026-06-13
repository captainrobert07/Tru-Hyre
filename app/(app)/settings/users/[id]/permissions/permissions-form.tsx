"use client";

import Link from "next/link";
import { PERMISSIONS } from "@/lib/permissions";

export function PermissionsForm({
  userId,
  granted,
  action,
}: {
  userId: number;
  granted: string[];
  action: (formData: FormData) => void | Promise<void>;
}) {
  const byCat = new Map<string, typeof PERMISSIONS>();
  for (const p of PERMISSIONS) {
    if (!byCat.has(p.category)) byCat.set(p.category, []);
    byCat.get(p.category)!.push(p);
  }
  const set = new Set(granted);

  return (
    <form action={action} className="space-y-5">
      {[...byCat.entries()].map(([cat, perms]) => (
        <section key={cat} className="card p-4">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-soft mb-2">{cat}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {perms.map((p) => (
              <label key={p.key} className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="permissions" value={p.key} defaultChecked={set.has(p.key)} className="size-4 rounded border-hairline text-brand-500 focus:ring-brand-500" />
                {p.label}
              </label>
            ))}
          </div>
        </section>
      ))}
      <div className="flex gap-2">
        <button type="submit" className="btn-primary">Save permissions</button>
        <Link href="/settings/users" className="btn-ghost">Back</Link>
      </div>
    </form>
  );
}
