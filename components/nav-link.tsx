"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/**
 * A nav Link that marks itself active for the current route. The app shell is a
 * server component (can't use usePathname), and `.nav-pill-item.active` styling
 * already exists in globals.css but was never applied — so the nav never showed
 * where you are, and screen readers got no `aria-current`. This client wrapper
 * fixes both: adds the `active` class + aria-current="page" on a match.
 *
 * Match rule: exact for "/dashboard"; prefix for section roots (so /candidates/123
 * still lights up the Candidates tab) — but a prefix only counts on a path
 * boundary, so /clients doesn't match /clients-archive.
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
  const active =
    href === "/dashboard"
      ? pathname === "/dashboard"
      : pathname === href || pathname.startsWith(href + "/");
  return (
    <Link href={href} className={active ? `${className} active` : className} aria-current={active ? "page" : undefined}>
      {children}
    </Link>
  );
}
