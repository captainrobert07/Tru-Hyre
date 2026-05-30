"use client";

import { useActionState } from "react";
import { loginAction } from "./actions";

export function LoginForm({ next, error }: { next?: string; error?: string }) {
  const [state, formAction, pending] = useActionState(
    async (_prev: { ok: false; error: string } | null, formData: FormData) => {
      const result = await loginAction(formData);
      return result || null;
    },
    null,
  );

  const message = state?.error || error;

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="next" value={next || "/"} />
      <div>
        <label htmlFor="email" className="label">Email</label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          autoFocus
          className="input"
          placeholder="you@truhyre.app"
        />
      </div>
      <div>
        <label htmlFor="password" className="label">Password</label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="input"
        />
      </div>
      {message && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
          {message}
        </div>
      )}
      <button type="submit" disabled={pending} className="btn-primary w-full">
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
