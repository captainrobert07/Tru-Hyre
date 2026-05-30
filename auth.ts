import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { authConfig } from "./auth.config";
import { db } from "./db";
import { users } from "./db/schema";

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
        } catch {
          // Swallow: keep stale token rather than 500ing the layout.
        }
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
