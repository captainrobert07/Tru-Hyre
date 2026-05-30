import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";

export type Crumb = {
  href?: string;
  label: ReactNode;
};

/**
 * Breadcrumb trail. Last crumb is treated as the current location
 * and rendered as plain text. Renders nothing if 0-1 crumbs.
 */
export function Breadcrumbs({ crumbs, className }: { crumbs: Crumb[]; className?: string }) {
  if (crumbs.length < 2) return null;
  return (
    <nav aria-label="Breadcrumb" className={`mb-3 ${className || ""}`}>
      <ol className="flex items-center flex-wrap gap-1 text-xs text-ink-muted">
        {crumbs.map((c, i) => {
          const isLast = i === crumbs.length - 1;
          return (
            <li key={i} className="inline-flex items-center gap-1">
              {c.href && !isLast ? (
                <Link href={c.href} className="hover:text-ink transition-colors truncate max-w-[180px]">
                  {c.label}
                </Link>
              ) : (
                <span className={isLast ? "text-ink-soft truncate max-w-[240px]" : "truncate max-w-[180px]"}>
                  {c.label}
                </span>
              )}
              {!isLast && <ChevronRight size={12} className="text-ink-muted shrink-0" />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
