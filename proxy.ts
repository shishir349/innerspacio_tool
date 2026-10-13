import type { NextRequest } from "next/server";
import { updateSessionAndAuthorize } from "@/lib/supabase/middleware";

export async function proxy(request: NextRequest) {
  return updateSessionAndAuthorize(request);
}

export const config = {
  matcher: [
    /*
     * Match every request except static assets and image optimization
     * files. Deliberately NOT excluding /api — unauthenticated API access
     * is exactly what this middleware exists to block.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
