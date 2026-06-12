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
        path.startsWith("/api/auth") ||
        path.startsWith("/api/health") ||
        path.startsWith("/api/cron") ||
        path.startsWith("/api/careers") ||
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
      const staffOnly = path.startsWith("/candidates") || path.startsWith("/jobs") ||
                         path.startsWith("/clients") || path.startsWith("/vendors") ||
                         path.startsWith("/submissions") || path.startsWith("/reports");
      const clientOnly = path.startsWith("/portal/client");
      const vendorOnly = path.startsWith("/portal/vendor");

      const homeForRole = role === "client" ? "/portal/client" : role === "vendor" ? "/portal/vendor" : "/dashboard";

      if (adminOnly && role !== "admin") return Response.redirect(new URL(homeForRole, nextUrl));
      if (staffOnly && role !== "admin" && role !== "hr") {
        return Response.redirect(new URL(homeForRole, nextUrl));
      }
      if (path === "/dashboard" && role !== "admin" && role !== "hr") {
        return Response.redirect(new URL(homeForRole, nextUrl));
      }
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
        (session.user as { id?: string }).id = token.id as string;
        (session.user as { role?: string }).role = token.role as string;
        (session.user as { fullName?: string }).fullName = token.fullName as string;
      }
      return session;
    },
  },
  providers: [],
} satisfies NextAuthConfig;
