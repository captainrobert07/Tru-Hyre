import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { LoginForm } from "./login-form";

export const metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const session = await auth();
  const params = await searchParams;
  if (session?.user) redirect(params.next || "/");

  return (
    <main className="login-bg min-h-screen flex items-center justify-center px-4 py-10">
      <div className="card w-full max-w-md p-8">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-semibold tracking-tight">Tru Hyre</h1>
          <p className="text-sm text-ink-soft mt-1">An Allianz HR Platform — Project by Kris</p>
        </div>
        <LoginForm next={params.next} error={params.error} />
      </div>
    </main>
  );
}
