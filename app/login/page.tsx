import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { APP_NAME, APP_TAGLINE } from "@/lib/utils";
import { LoginForm } from "./login-form";

export const metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string; accepted?: string }>;
}) {
  const session = await auth();
  const params = await searchParams;
  if (session?.user) redirect(params.next || "/dashboard");

  return (
    <main className="login-bg min-h-screen flex items-center justify-center px-4 py-10 relative overflow-hidden">
      <div className="absolute -top-32 -left-32 size-80 rounded-full blob-emerald opacity-20 blur-2xl" />
      <div className="absolute -bottom-40 -right-32 size-96 rounded-full blob-emerald opacity-20 blur-2xl" />

      <div className="relative w-full max-w-md">
        <div className="text-center mb-6">
          <Link href="/" className="inline-flex items-center gap-2 mb-5">
            <span className="size-10 rounded-xl2 bg-brand-500 flex items-center justify-center text-white font-display italic text-xl">T</span>
            <span className="text-lg font-semibold tracking-tight">{APP_NAME}</span>
          </Link>
          <h1 className="display text-3xl md:text-4xl">Welcome <em>back</em>.</h1>
          <p className="text-sm text-ink-soft mt-2">{APP_TAGLINE}</p>
        </div>
        <div className="card p-7">
          {params.accepted && (
            <div className="text-sm text-brand-700 bg-brand-50 border border-brand-100 rounded-xl2 px-3 py-2.5 mb-4">
              Invitation accepted. Sign in with your new password.
            </div>
          )}
          <LoginForm next={params.next} error={params.error} />
        </div>
        <p className="text-xs text-ink-muted text-center mt-4">
          Don&apos;t have an account? <Link href="/" className="text-ink-soft hover:underline">Back to home</Link>
        </p>
      </div>
    </main>
  );
}
