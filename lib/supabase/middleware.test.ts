import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/config", () => ({
  isSupabaseConfigured: vi.fn(),
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn(),
}));

import { isSupabaseConfigured } from "@/lib/config";
import { createServerClient } from "@supabase/ssr";
import { updateSessionAndAuthorize } from "./middleware";

function mockUser(user: { id: string } | null) {
  (createServerClient as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) },
  });
}

const originalNodeEnv = process.env.NODE_ENV;

describe("updateSessionAndAuthorize", () => {
  afterEach(() => {
    vi.clearAllMocks();
    (process.env as Record<string, string | undefined>).NODE_ENV = originalNodeEnv;
  });

  it("blocks all access when demo mode is reached in production", async () => {
    (isSupabaseConfigured as unknown as ReturnType<typeof vi.fn>).mockReturnValue(false);
    (process.env as Record<string, string | undefined>).NODE_ENV = "production";

    const request = new NextRequest(new URL("http://localhost/dashboard"));
    const response = await updateSessionAndAuthorize(request);

    expect(response.status).toBe(503);
  });

  it("allows demo mode through in development (no Supabase configured)", async () => {
    (isSupabaseConfigured as unknown as ReturnType<typeof vi.fn>).mockReturnValue(false);
    (process.env as Record<string, string | undefined>).NODE_ENV = "development";

    const request = new NextRequest(new URL("http://localhost/dashboard"));
    const response = await updateSessionAndAuthorize(request);

    expect(response.status).toBe(200);
  });

  it("redirects an unauthenticated page request to /login, preserving the destination", async () => {
    (isSupabaseConfigured as unknown as ReturnType<typeof vi.fn>).mockReturnValue(true);
    mockUser(null);

    const request = new NextRequest(new URL("http://localhost/projects/abc-123"));
    const response = await updateSessionAndAuthorize(request);

    expect(response.status).toBe(307);
    const location = response.headers.get("location");
    expect(location).toContain("/login");
    expect(location).toContain("redirectTo=%2Fprojects%2Fabc-123");
  });

  it("returns a 401 JSON body for an unauthenticated API request, not a redirect", async () => {
    (isSupabaseConfigured as unknown as ReturnType<typeof vi.fn>).mockReturnValue(true);
    mockUser(null);

    const request = new NextRequest(
      new URL("http://localhost/api/projects/p1/rooms/r1/analyze")
    );
    const response = await updateSessionAndAuthorize(request);

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.code).toBe("unauthorized");
  });

  it("lets an authenticated request through to a protected page", async () => {
    (isSupabaseConfigured as unknown as ReturnType<typeof vi.fn>).mockReturnValue(true);
    mockUser({ id: "user-1" });

    const request = new NextRequest(new URL("http://localhost/dashboard"));
    const response = await updateSessionAndAuthorize(request);

    expect(response.status).toBe(200);
  });

  it("allows an unauthenticated request to reach /login itself", async () => {
    (isSupabaseConfigured as unknown as ReturnType<typeof vi.fn>).mockReturnValue(true);
    mockUser(null);

    const request = new NextRequest(new URL("http://localhost/login"));
    const response = await updateSessionAndAuthorize(request);

    expect(response.status).toBe(200);
  });

  it("redirects an already-authenticated user away from /login", async () => {
    (isSupabaseConfigured as unknown as ReturnType<typeof vi.fn>).mockReturnValue(true);
    mockUser({ id: "user-1" });

    const request = new NextRequest(new URL("http://localhost/login"));
    const response = await updateSessionAndAuthorize(request);

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("/dashboard");
  });

  it("allows an unauthenticated request to reach /present/[token] — it has its own auth", async () => {
    (isSupabaseConfigured as unknown as ReturnType<typeof vi.fn>).mockReturnValue(true);
    mockUser(null);

    const request = new NextRequest(new URL("http://localhost/present/some-token-value"), {
      headers: { "x-forwarded-for": "203.0.113.1" },
    });
    const response = await updateSessionAndAuthorize(request);

    expect(response.status).toBe(200);
  });

  it("sets a private, no-store Cache-Control header on /present responses", async () => {
    (isSupabaseConfigured as unknown as ReturnType<typeof vi.fn>).mockReturnValue(true);
    mockUser(null);

    const request = new NextRequest(new URL("http://localhost/present/some-token-value"), {
      headers: { "x-forwarded-for": "203.0.113.2" },
    });
    const response = await updateSessionAndAuthorize(request);

    expect(response.headers.get("Cache-Control")).toContain("no-store");
    expect(response.headers.get("Cache-Control")).toContain("private");
  });

  it("does not set the no-store header on an ordinary authenticated page", async () => {
    (isSupabaseConfigured as unknown as ReturnType<typeof vi.fn>).mockReturnValue(true);
    mockUser({ id: "user-1" });

    const request = new NextRequest(new URL("http://localhost/dashboard"), {
      headers: { "x-forwarded-for": "203.0.113.3" },
    });
    const response = await updateSessionAndAuthorize(request);

    expect(response.headers.get("Cache-Control")).toBeNull();
  });

  it("rate-limits repeated /present requests from the same IP", async () => {
    (isSupabaseConfigured as unknown as ReturnType<typeof vi.fn>).mockReturnValue(true);
    mockUser(null);

    const ip = "203.0.113.42";
    let lastResponse;
    for (let i = 0; i < 61; i++) {
      const request = new NextRequest(new URL("http://localhost/present/some-token-value"), {
        headers: { "x-forwarded-for": ip },
      });
      lastResponse = await updateSessionAndAuthorize(request);
    }

    expect(lastResponse!.status).toBe(429);
    expect(lastResponse!.headers.get("Retry-After")).toBeTruthy();
  });

  it("does not rate-limit /present requests from a different IP after another IP is limited", async () => {
    (isSupabaseConfigured as unknown as ReturnType<typeof vi.fn>).mockReturnValue(true);
    mockUser(null);

    const request = new NextRequest(new URL("http://localhost/present/some-token-value"), {
      headers: { "x-forwarded-for": "203.0.113.99" },
    });
    const response = await updateSessionAndAuthorize(request);

    expect(response.status).toBe(200);
  });
});
