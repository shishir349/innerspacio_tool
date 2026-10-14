import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/config", () => ({ isSupabaseConfigured: vi.fn() }));
vi.mock("@supabase/ssr", () => ({ createServerClient: vi.fn() }));

import { isSupabaseConfigured } from "@/lib/config";
import { createServerClient } from "@supabase/ssr";
import { updateSessionAndAuthorize } from "./middleware";

function loggedOut() {
  (isSupabaseConfigured as unknown as ReturnType<typeof vi.fn>).mockReturnValue(true);
  (createServerClient as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
  });
}

describe("public quote surface", () => {
  afterEach(() => vi.clearAllMocks());

  it("lets a logged-out visitor reach /get-quote, never cached", async () => {
    loggedOut();
    const res = await updateSessionAndAuthorize(new NextRequest(new URL("http://localhost/get-quote")));
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toContain("no-store");
  });

  it("lets a logged-out visitor reach /api/public/* (no 401 from the proxy)", async () => {
    loggedOut();
    const res = await updateSessionAndAuthorize(
      new NextRequest(new URL("http://localhost/api/public/quote"), { method: "POST" })
    );
    expect(res.status).toBe(200);
  });

  it("still blocks internal pages and APIs for a logged-out visitor", async () => {
    loggedOut();
    const page = await updateSessionAndAuthorize(new NextRequest(new URL("http://localhost/dashboard")));
    expect(page.status).toBe(307);
    const api = await updateSessionAndAuthorize(
      new NextRequest(new URL("http://localhost/api/projects/a/rooms/b/estimate"), { method: "POST" })
    );
    expect(api.status).toBe(401);
  });
});
