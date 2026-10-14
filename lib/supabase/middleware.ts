import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isSupabaseConfigured } from "@/lib/config";
import { enforceRateLimit, RateLimitedError } from "@/lib/rate-limit";

// /login: unauthenticated-by-definition. /present: its own token-based auth
// (see lib/presentation-links/token.ts) — never gated by a Supabase session,
// since the client visiting it has no Supabase account.
// /get-quote and /api/public: the public self-serve quote flow (token-gated per lead).
const PUBLIC_PATHS = ["/login", "/present", "/get-quote", "/api/public"];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export function clientIp(request: NextRequest): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0].trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}

/**
 * Coarse, IP-keyed abuse protection on the whole /present/* surface —
 * independent of the per-link rate limits inside the Server Actions that
 * actually write data (lib/actions/presentation-client.ts). This one
 * protects against scripted token-guessing/scraping across *any* link;
 * that one protects one specific link from being spammed once its token is
 * known. Both are the same in-memory limiter — see lib/rate-limit.ts for
 * why that's not sufficient for a multi-instance production deployment.
 */
async function enforcePresentRouteRateLimit(request: NextRequest): Promise<NextResponse | null> {
  try {
    await enforceRateLimit(`present-route:${clientIp(request)}`, { limit: 60, windowSeconds: 60 });
    return null;
  } catch (error) {
    if (error instanceof RateLimitedError) {
      return new NextResponse("Too many requests. Please try again shortly.", {
        status: 429,
        headers: { "Retry-After": String(error.retryAfterSeconds) },
      });
    }
    throw error;
  }
}

/**
 * Runs on every request (see proxy.ts). Refreshes the Supabase session
 * cookie and blocks unauthenticated access to everything except /login.
 *
 * This is the actual security boundary for route access — not any
 * client-side redirect. Pages and Server Actions still call
 * requireUser()/requirePageUser() themselves too, as defense in depth and
 * because this middleware can't see inside a Server Action's own logic.
 */
export async function updateSessionAndAuthorize(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;
  // Same treatment for every anonymous surface: IP rate limit + never cached.
  const isPresentRoute = ["/present", "/get-quote", "/api/public"].some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );

  if (isPresentRoute) {
    const limited = await enforcePresentRouteRateLimit(request);
    if (limited) return limited;
  }

  let response = NextResponse.next({ request });

  if (!isSupabaseConfigured()) {
    // Demo mode: no identity provider exists to authenticate against.
    // Only acceptable for local development — never in production.
    if (process.env.NODE_ENV === "production") {
      return new NextResponse(
        "This app is running in demo mode (no Supabase configured) and demo mode may not be " +
          "exposed in production without authentication. Configure Supabase and sign in, or run " +
          "this build only in a development environment.",
        { status: 503 }
      );
    }
    return applyNoStoreIfPresent(response, isPresentRoute);
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // getUser() revalidates against Supabase Auth — never trust getSession() alone here.
  const { data } = await supabase.auth.getUser();
  const user = data.user;

  if (!user && !isPublicPath(pathname)) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { error: "Unauthorized. Please sign in.", code: "unauthorized" },
        { status: 401 }
      );
    }
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirectTo", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (user && pathname === "/login") {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return applyNoStoreIfPresent(response, isPresentRoute);
}

/**
 * Token-protected responses must never be cached by a shared/public cache
 * (CDN, proxy, browser disk cache shared across users on the same device,
 * etc.) — each one is specific to whoever holds that token.
 */
function applyNoStoreIfPresent(response: NextResponse, isPresentRoute: boolean): NextResponse {
  if (isPresentRoute) {
    response.headers.set("Cache-Control", "private, no-store, no-cache, must-revalidate");
  }
  return response;
}
