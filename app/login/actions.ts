"use server";

import { AuthError } from "next-auth";
import { signIn } from "@/auth";

export async function loginAction(formData: FormData): Promise<{ ok: false; error: string } | void> {
  const next = (formData.get("next") as string) || "/";
  try {
    await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      redirectTo: next,
    });
  } catch (e) {
    if (e instanceof AuthError) {
      if (e.type === "CredentialsSignin") {
        return { ok: false, error: "Invalid email or password." };
      }
      return { ok: false, error: "Sign-in failed. Try again." };
    }
    throw e;
  }
}
