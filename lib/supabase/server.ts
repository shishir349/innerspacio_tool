import "server-only";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { isSupabaseConfigured } from "@/lib/config";

/** Request-scoped Supabase client, bound to the signed-in user's session via cookies. */
export async function createSupabaseServerClient() {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase is not configured.");
  }
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component render — middleware refreshes the session instead.
          }
        },
      },
    }
  );
}

/**
 * Service-role client — bypasses RLS entirely. Not currently called from
 * anywhere in the running app (every request-handling code path uses
 * `createSupabaseServerClient()` above instead, so Postgres RLS is always
 * the enforcing layer for a live request). The only consumer is
 * scripts/create-user.ts, an operator-run CLI script, which imports
 * `@supabase/supabase-js` directly rather than this file (this file has
 * `import "server-only"` at the top, which breaks outside Next's runtime).
 * Keep it that way: if you're tempted to call this from a Server Action,
 * API route or page, add an explicit `requireUser()`/authorization check
 * immediately before the call, and say why RLS alone wasn't enough.
 */
export function createSupabaseAdminClient() {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase is not configured.");
  }
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}
