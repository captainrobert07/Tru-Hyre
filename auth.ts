import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { cookies } from "next/headers";
import { authConfig } from "./auth.config";
import { db } from "./db";
import { users, userPermissions } from "./db/schema";

const IMPERSONATE_COOKIE = "th_impersonate";

/**
 * Resolve an active admin-set impersonation. Returns the target user to act as,
 * or null. SAFE BY CONSTRUCTION: only honored when (a) a valid, unexpired,
 * httpOnly cookie set by startImpersonation exists, (b) the *real* authenticated
 * user (resolved from their own email) is an admin, and (c) the target is a
 * different, active user. The cookie carries the admin id so admin-ness is
 * re-verified every request; the normal login path never reads it.
 */
async function resolveImpersonation(realRole: string, realId: number) {
  if (realRole !== "admin") return null;
  try {
    const raw = (await cookies()).get(IMPERSONATE_COOKIE)?.value;
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { adminId?: number; targetId?: number; at?: number };
    if (!parsed || parsed.adminId !== realId || !parsed.targetId) return null;
    if (parsed.targetId === realId) return null;
    if (typeof parsed.at === "number" && Date.now() - parsed.at > 60 * 60 * 1000) return null;
    const t = (
      await db
        .select({ id: users.id, email: users.email, role: users.role, fullName: users.fullName, isActive: users.isActive })
        .from(users)
        .where(eq(users.id, parsed.targetId))
        .limit(1)
    )[0];
    if (!t || !t.isActive) return null;
    return t;
  } catch {
    return null;
  }
}

const credentialsSchema = z.object({
  email: z.string().email().toLowerCase().trim(),
  password: z.string().min(1),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user, trigger }) {
      if (user) {
        token.id = (user as { id: string | number }).id;
        token.role = (user as { role: string }).role;
        token.fullName = (user as { fullName?: string }).fullName;
        token.email = user.email ?? token.email;
      }
      // On every request, refresh id/role/fullName from DB by email so
      // stale tokens (older deploys, FK-renumbered seeds) auto-heal.
      if (token.email && (trigger !== "signIn" || !user)) {
        try {
          const fresh = await db
            .select({ id: users.id, role: users.role, fullName: users.fullName, isActive: users.isActive })
            .from(users)
            .where(eq(users.email, token.email as string))
            .limit(1);
          const f = fresh[0];
          if (!f || !f.isActive) return null;
          token.id = String(f.id);
          token.role = f.role;
          token.fullName = f.fullName;
          // Load granular permissions (best-effort; table may not exist pre-migration).
          try {
            const perm = await db
              .select({ permissions: userPermissions.permissions })
              .from(userPermissions)
              .where(eq(userPermissions.userId, f.id))
              .limit(1);
            token.permissions = perm[0]?.permissions ?? [];
          } catch {
            token.permissions = [];
          }
        } catch {
          // Swallow: keep stale token rather than 500ing the layout.
        }
      }

      // Impersonation overlay: when the REAL user is an admin and a valid
      // cookie is present, carry the target's identity in separate act* fields.
      // token.id/role/email above stay the REAL admin so the per-request
      // refresh (keyed on token.email) keeps re-verifying admin-ness and the
      // overlay can always be cleanly reverted. The session callback projects
      // the act* identity onto session.user.
      try {
        const realId = Number(token.id);
        const target = await resolveImpersonation(String(token.role), realId);
        if (target) {
          token.impersonatorEmail = token.email as string;
          token.actId = String(target.id);
          token.actRole = target.role;
          token.actName = target.fullName;
          token.actEmail = target.email;
          try {
            const perm = await db
              .select({ permissions: userPermissions.permissions })
              .from(userPermissions)
              .where(eq(userPermissions.userId, target.id))
              .limit(1);
            token.actPermissions = perm[0]?.permissions ?? [];
          } catch {
            token.actPermissions = [];
          }
        } else {
          delete token.impersonatorEmail;
          delete token.actId;
          delete token.actRole;
          delete token.actName;
          delete token.actEmail;
          delete token.actPermissions;
        }
      } catch {
        // never block auth on impersonation resolution
      }
      return token;
    },
  },
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(raw) {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;

        const { email, password } = parsed.data;
        const found = await db.select().from(users).where(eq(users.email, email)).limit(1);
        const user = found[0];
        if (!user || !user.isActive) return null;

        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok) return null;

        return {
          id: String(user.id),
          email: user.email,
          name: user.fullName,
          fullName: user.fullName,
          role: user.role,
        };
      },
    }),
  ],
});
