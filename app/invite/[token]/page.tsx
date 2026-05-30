import { eq } from "drizzle-orm";
import Link from "next/link";
import { db } from "@/db";
import { invitations, clientAccounts, vendorAccounts } from "@/db/schema";
import { Badge } from "@/components/primitives";
import { APP_NAME } from "@/lib/utils";
import { acceptInvitationAction } from "./actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Accept invitation" };

export default async function InvitePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { token } = await params;
  const { error } = await searchParams;

  const inv = (await db.select().from(invitations).where(eq(invitations.token, token)).limit(1))[0];

  if (!inv) {
    return <Shell title="Invitation not found" body="Double-check the link, or ask your Tru Hyre admin to send a fresh invite." />;
  }
  if (inv.status === "revoked") {
    return <Shell title="Invitation revoked" body="This invitation was withdrawn. Reach out to your admin for a new one." />;
  }
  if (inv.status === "accepted") {
    return (
      <Shell
        title="Already accepted"
        body="This invitation has already been used. Sign in below."
        cta={{ href: "/login", label: "Go to sign in" }}
      />
    );
  }
  if (inv.expiresAt && new Date(inv.expiresAt) < new Date()) {
    return <Shell title="Invitation expired" body="This invitation expired. Ask your admin to resend." />;
  }

  const [linkClient, linkVendor] = await Promise.all([
    inv.clientAccountId
      ? db.select().from(clientAccounts).where(eq(clientAccounts.id, inv.clientAccountId)).limit(1).then((r) => r[0])
      : Promise.resolve(undefined),
    inv.vendorAccountId
      ? db.select().from(vendorAccounts).where(eq(vendorAccounts.id, inv.vendorAccountId)).limit(1).then((r) => r[0])
      : Promise.resolve(undefined),
  ]);

  return (
    <main className="login-bg min-h-screen flex items-center justify-center px-4 py-10">
      <div className="card w-full max-w-md p-8">
        <div className="text-center mb-5">
          <h1 className="text-2xl font-semibold tracking-tight">Welcome to {APP_NAME}</h1>
          <p className="text-sm text-ink-soft mt-1">Set your password to activate your account.</p>
        </div>

        <div className="rounded-lg border border-hairline bg-canvas px-3 py-2.5 mb-5 text-sm space-y-1">
          <div className="flex justify-between">
            <span className="text-ink-muted text-xs uppercase tracking-wide">Email</span>
            <span className="font-medium">{inv.email}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-ink-muted text-xs uppercase tracking-wide">Role</span>
            <Badge tone={inv.role === "admin" ? "blue" : inv.role === "hr" ? "default" : inv.role === "client" ? "green" : "amber"}>
              {inv.role}
            </Badge>
          </div>
          {(linkClient?.name || linkVendor?.name) && (
            <div className="flex justify-between">
              <span className="text-ink-muted text-xs uppercase tracking-wide">Account</span>
              <span className="text-ink-soft">{linkClient?.name || linkVendor?.name}</span>
            </div>
          )}
        </div>

        <form action={acceptInvitationAction.bind(null, token)} className="space-y-3">
          <div>
            <label htmlFor="fullName" className="label">Full name</label>
            <input id="fullName" name="fullName" required minLength={2} maxLength={120} className="input" />
          </div>
          <div>
            <label htmlFor="password" className="label">Choose a password</label>
            <input id="password" name="password" type="password" required minLength={8} maxLength={120} className="input" />
            <p className="text-xs text-ink-muted mt-1">8+ characters.</p>
          </div>
          {error && (
            <div className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
              {error === "weak_password" ? "Password must be 8+ characters." :
               error === "email_taken" ? "An account with this email already exists. Try signing in." :
               "Couldn't accept the invitation. Try again."}
            </div>
          )}
          <button type="submit" className="btn-primary w-full">Activate account</button>
        </form>
      </div>
    </main>
  );
}

function Shell({ title, body, cta }: { title: string; body: string; cta?: { href: string; label: string } }) {
  return (
    <main className="login-bg min-h-screen flex items-center justify-center px-4 py-10">
      <div className="card w-full max-w-md p-8 text-center space-y-3">
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        <p className="text-sm text-ink-soft">{body}</p>
        {cta ? (
          <Link href={cta.href} className="btn-primary inline-flex">{cta.label}</Link>
        ) : (
          <Link href="/login" className="btn-ghost inline-flex">Back to sign in</Link>
        )}
      </div>
    </main>
  );
}
