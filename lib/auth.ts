import "server-only";
import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { isSupabaseConfigured } from "@/lib/config";

const DEMO_USER = { id: "demo-user", email: "demo@innerspacio.local" } as User;

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
 * In local demo mode (no Supabase configured) it resolves to a fixed demo user;
 * outside development it stays null, and demo mode's own production guard lives
 * in `proxy.ts`.
 */
export async function getCurrentUser(): Promise<User | null> {
  if (!isSupabaseConfigured()) {
    // Local demo mode (no Supabase env): one fixed demo user so every page renders for development.
    // Never in production: proxy.ts already answers 503 there, and this stays null.
    return process.env.NODE_ENV === "production" ? null : DEMO_USER;
  }
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
