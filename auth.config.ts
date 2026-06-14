import type { NextAuthConfig } from "next-auth";

export const authConfig = {
  pages: {
    signIn: "/login",
  },
  session: { strategy: "jwt" },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const path = nextUrl.pathname;

      const isPublic =
        path === "/" ||
        path === "/login" ||
        path.startsWith("/invite/") ||
        path.startsWith("/careers") ||
        path.startsWith("/refer/") ||
        path.startsWith("/schedule/") ||
        path.startsWith("/api/auth") ||
        path.startsWith("/api/health") ||
        path.startsWith("/api/cron") ||
        path.startsWith("/api/careers") ||
        path.startsWith("/api/v1") ||
        path.startsWith("/_next") ||
        path === "/favicon.ico";

      if (isPublic) return true;
      if (!isLoggedIn) {
        const url = new URL("/login", nextUrl);
        url.searchParams.set("next", path);
        return Response.redirect(url);
      }

      const role = (auth?.user as { role?: string } | undefined)?.role;
      const adminOnly = path.startsWith("/admin") || path.startsWith("/settings");
      // Full staff (admin/hr) only — hr_lite is excluded from these.
      const fullStaffOnly = path.startsWith("/jobs") || path.startsWith("/clients") ||
                            path.startsWith("/vendors") || path.startsWith("/submissions") ||
                            path.startsWith("/reports") || path.startsWith("/activity") ||
                            path.startsWith("/inbox");
      // Candidate surfaces + dashboard — full staff AND hr_lite (lite is scoped
      // to its own uploads inside the pages/actions).
      const staffOrLite = path.startsWith("/candidates") || path === "/dashboard";
      const clientOnly = path.startsWith("/portal/client");
      const vendorOnly = path.startsWith("/portal/vendor");
      const candidateOnly = path.startsWith("/portal/candidate");

      const isFullStaff = role === "admin" || role === "hr";
      const isAnyStaff = isFullStaff || role === "hr_lite";
      // hr_lite's home is the candidate list (no org-wide dashboard).
      const homeForRole = role === "client" ? "/portal/client"
        : role === "vendor" ? "/portal/vendor"
        : role === "candidate" ? "/portal/candidate"
        : role === "hr_lite" ? "/candidates"
        : "/dashboard";

      // hr_lite must never reach the org-wide dashboard — bounce at the edge,
      // before the page computes any cross-candidate data.
      if (path === "/dashboard" && role === "hr_lite") {
        return Response.redirect(new URL("/candidates", nextUrl));
      }

      // Ordered most-restrictive → least, so a new overlapping path can't leak.
      if (adminOnly && role !== "admin") return Response.redirect(new URL(homeForRole, nextUrl));
      if (fullStaffOnly && !isFullStaff) return Response.redirect(new URL(homeForRole, nextUrl));
      if (staffOrLite && !isAnyStaff) return Response.redirect(new URL(homeForRole, nextUrl));
      if (candidateOnly && role !== "candidate" && role !== "admin") return Response.redirect(new URL(homeForRole, nextUrl));
      if (clientOnly && role !== "client" && role !== "admin") return Response.redirect(new URL(homeForRole, nextUrl));
      if (vendorOnly && role !== "vendor" && role !== "admin") return Response.redirect(new URL(homeForRole, nextUrl));

      return true;
    },
    jwt({ token, user }) {
      if (user) {
        token.id = (user as { id: string | number }).id;
        token.role = (user as { role: string }).role;
        token.fullName = (user as { fullName?: string }).fullName;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        const impersonating = !!token.actId;
        const u = session.user as {
          id?: string; role?: string; fullName?: string; email?: string;
          permissions?: string[]; impersonating?: boolean; impersonatorEmail?: string;
        };
        // When impersonating, project the TARGET identity onto the session so
        // every page/action/route sees the acting user; otherwise the real user.
        u.id = (impersonating ? token.actId : token.id) as string;
        u.role = (impersonating ? token.actRole : token.role) as string;
        u.fullName = (impersonating ? token.actName : token.fullName) as string;
        if (impersonating) u.email = token.actEmail as string;
        u.permissions = ((impersonating ? token.actPermissions : token.permissions) as string[] | undefined) ?? [];
        u.impersonating = impersonating;
        u.impersonatorEmail = impersonating ? (token.impersonatorEmail as string) : undefined;
      }
      return session;
    },
  },
  providers: [],
} satisfies NextAuthConfig;
