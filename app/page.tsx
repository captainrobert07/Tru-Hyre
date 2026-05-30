import { redirect } from "next/navigation";
import { auth, signOut } from "@/auth";

export default async function HomePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const role = (session.user as { role?: string }).role;
  if (role === "client") redirect("/portal/client");
  if (role === "vendor") redirect("/portal/vendor");

  const name = (session.user as { fullName?: string }).fullName || session.user.email;

  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-10">
      <div className="card max-w-xl w-full p-8 space-y-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Welcome, {name}</h1>
          <p className="text-sm text-ink-soft mt-1">Role: <span className="font-medium">{role}</span></p>
        </div>
        <p className="text-sm text-ink-soft">
          Phase 1 scaffold is live. Domain modules (candidates, jobs, clients, vendors, submissions,
          notifications, reports, settings) ship in subsequent phases.
        </p>
        <form action={async () => { "use server"; await signOut({ redirectTo: "/login" }); }}>
          <button className="btn-ghost text-sm" type="submit">Sign out</button>
        </form>
      </div>
    </main>
  );
}
