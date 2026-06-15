import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || "Tru Hyre";
export const APP_TAGLINE = process.env.NEXT_PUBLIC_APP_TAGLINE || "An internal hiring platform";

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
