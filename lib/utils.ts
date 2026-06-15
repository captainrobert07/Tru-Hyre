import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || "Tru Hyre";
export const APP_TAGLINE = process.env.NEXT_PUBLIC_APP_TAGLINE || "An internal hiring platform";

/**
 * Is `href` the active nav destination for the current `pathname`?
 * Shared by the desktop NavLink and the mobile bottom-nav link so the two navs
 * can never disagree on what "current page" means. Rule: exact match for
 * "/dashboard" (it's the root, so a prefix would light up for everything);
 * for section roots, match the exact path or a path-boundary prefix (so
 * /candidates/123 lights up Candidates, but /clients-archive doesn't match /clients).
 */
export function isNavActive(pathname: string, href: string): boolean {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname === href || pathname.startsWith(href + "/");
}

/**
 * Sanitize a user-supplied URL before using it as an href. Candidate/client URL
 * fields (linkedinUrl, githubUrl, website) are stored as free text — a value
 * like `javascript:...` or `data:...` rendered into href is a stored-XSS vector
 * that fires in the viewer's authenticated session. Returns the URL only when
 * it parses as http(s); otherwise undefined (so the link simply isn't rendered).
 */
export function safeExternalUrl(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  const trimmed = url.trim();
  try {
    const u = new URL(trimmed);
    return u.protocol === "http:" || u.protocol === "https:" ? trimmed : undefined;
  } catch {
    // Not an absolute URL (e.g. "linkedin.com/in/x"). Allow only if it's a bare
    // host/path we can safely prefix with https:// — reject anything with a scheme.
    if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) return undefined; // has a scheme we didn't allow
    return `https://${trimmed}`;
  }
}
