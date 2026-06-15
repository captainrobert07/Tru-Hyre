"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { isNavActive } from "@/lib/utils";

/**
 * Bottom-nav (mobile) tab that marks itself active for the current route. The
 * desktop nav got an active indicator in iter 88 (NavLink); this is its mobile
 * counterpart so the two navs match — on a phone you can now see which tab
 * you're on. Active treatment fits the bottom-bar style (brand-tinted icon +
 * label, no pill fill) and sets aria-current="page" for screen readers. The
 * active-match rule is shared via isNavActive so the navs can't drift.
 */
export function MobileNavLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  const pathname = usePathname() || "/";
  const active = isNavActive(pathname, href);
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`flex flex-col items-center justify-center text-[10px] gap-0.5 relative ${
        active ? "text-brand-600 [&_svg]:text-brand-600" : "text-ink-soft [&_svg]:text-ink-muted"
      }`}
    >
      {children}
    </Link>
  );
}
