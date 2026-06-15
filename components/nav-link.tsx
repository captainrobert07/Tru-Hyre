"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { isNavActive } from "@/lib/utils";

/**
 * A nav Link that marks itself active for the current route. The app shell is a
 * server component (can't use usePathname), and `.nav-pill-item.active` styling
 * already exists in globals.css but was never applied — so the nav never showed
 * where you are, and screen readers got no `aria-current`. This client wrapper
 * fixes both: adds the `active` class + aria-current="page" on a match.
 *
 * Active-match rule lives in `isNavActive` (lib/utils) so the desktop and mobile
 * navs share one definition of "current page".
 */
export function NavLink({
  href,
  className,
  children,
}: {
  href: string;
  className: string;
  children: ReactNode;
}) {
  const pathname = usePathname() || "/";
  const active = isNavActive(pathname, href);
  return (
    <Link href={href} className={active ? `${className} active` : className} aria-current={active ? "page" : undefined}>
      {children}
    </Link>
  );
}
