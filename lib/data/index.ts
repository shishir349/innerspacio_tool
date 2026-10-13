import "server-only";
import { isSupabaseConfigured } from "@/lib/config";
import { DemoRepository } from "@/lib/data/demo-store";
import type { Repository } from "@/lib/data/types";

let demoRepository: Repository | null = null;

/**
 * Returns the repository implementation for the current request.
 * Falls back to the local JSON demo store automatically whenever Supabase
 * credentials are not configured — the app stays fully usable without them.
 *
 * Uses the user-session-bound client (not the service-role client): now
 * that real sign-in exists (see lib/auth.ts, proxy.ts), a signed-in
 * request carries a valid "authenticated" JWT, which is exactly what the
 * RLS policies in supabase/migrations/0001_init.sql check for. This keeps
 * Postgres's own row-level security as a second, independent enforcement
 * layer beneath the application-level `requireUser()` checks in every
 * Server Action and API route — not just one or the other.
 *
 * The service-role client is still used, deliberately, in a couple of
 * narrow, documented places (see README's "Service-role key usage" table):
 * scripts/create-user.ts (Supabase Auth's admin user-creation API has no
 * session-bound equivalent) — never here, and never anywhere reachable
 * from an unauthenticated request.
 */
export async function getRepository(): Promise<Repository> {
  if (isSupabaseConfigured()) {
    const { SupabaseRepository } = await import("@/lib/data/supabase-store");
    const { createSupabaseServerClient } = await import("@/lib/supabase/server");
    const client = await createSupabaseServerClient();
    return new SupabaseRepository(client);
  }
  if (!demoRepository) {
    demoRepository = new DemoRepository();
  }
  return demoRepository;
}

export * from "@/lib/data/types";
