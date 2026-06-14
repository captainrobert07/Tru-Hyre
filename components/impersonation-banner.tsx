import { auth } from "@/auth";
import { stopImpersonation } from "@/app/(app)/settings/users/[id]/admin-actions";

/**
 * Global impersonation banner. Reads the session itself and renders nothing
 * unless an admin is currently impersonating another user — so it can be
 * mounted once in the root layout and cover staff AND portal surfaces without
 * per-page wiring. Makes the elevated state impossible to miss and gives a
 * one-click exit.
 */
export async function ImpersonationBanner() {
  const session = await auth();
  const u = session?.user as { impersonating?: boolean; impersonatorEmail?: string; fullName?: string; email?: string } | undefined;
  if (!u?.impersonating) return null;
  const actingAs = u.fullName || u.email || "user";

  return (
    <div className="sticky top-0 z-[60] bg-amber-500 text-amber-950 text-sm">
      <div className="max-w-[1400px] mx-auto px-4 md:px-8 lg:px-10 py-2 flex items-center justify-between gap-3">
        <span className="font-medium truncate">
          ⚠️ Viewing as <strong>{actingAs}</strong>
          {u.impersonatorEmail ? <span className="hidden sm:inline font-normal"> · signed in as {u.impersonatorEmail}</span> : null}
        </span>
        <form action={stopImpersonation}>
          <button type="submit" className="shrink-0 rounded-full bg-amber-950 text-amber-50 text-xs font-medium px-3 h-7 hover:bg-amber-900">
            Stop impersonating
          </button>
        </form>
      </div>
    </div>
  );
}
