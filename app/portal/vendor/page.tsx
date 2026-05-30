import { auth, signOut } from "@/auth";
import { redirect } from "next/navigation";

export default async function VendorPortal() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const name = (session.user as { fullName?: string }).fullName || session.user.email;

  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-10">
      <div className="card max-w-xl w-full p-8 space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight">Vendor Portal</h1>
        <p className="text-sm text-ink-soft">Welcome, {name}.</p>
        <p className="text-sm text-ink-soft">Assigned jobs and your submissions land here in Phase 3.</p>
        <form action={async () => { "use server"; await signOut({ redirectTo: "/login" }); }}>
          <button className="btn-ghost text-sm" type="submit">Sign out</button>
        </form>
      </div>
    </main>
  );
}
