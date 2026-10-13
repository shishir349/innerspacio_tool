import "server-only";
import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { isSupabaseConfigured } from "@/lib/config";

export class AuthError extends Error {
  readonly code = "unauthorized" as const;
}

/**
 * Returns the current authenticated user, or null.
 *
 * Deliberately uses `supabase.auth.getUser()`, not `getSession()` —
 * `getSession()` only reads the (possibly stale or forged) cookie payload,
 * while `getUser()` revalidates the token against Supabase Auth itself.
 * This is the one function every protected operation should route through.
 *
 * In demo mode (no Supabase configured), there is no identity provider to
 * check against, so this always resolves to null; demo mode's own
 * production guard lives in `proxy.ts`, not here.
 */
export async function getCurrentUser(): Promise<User | null> {
  if (!isSupabaseConfigured()) return null;
  const { createSupabaseServerClient } = await import("@/lib/supabase/server");
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return data.user;
}

/** For Server Actions / API routes: returns the user or throws AuthError. Never redirects. */
export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) {
    throw new AuthError("You must be signed in to do that.");
  }
  return user;
}

/** For Server Component pages: returns the user or redirects to /login. */
export async function requirePageUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  return user;
}
