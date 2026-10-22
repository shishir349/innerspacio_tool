import { describe, expect, it, vi } from "vitest";

const boqs = new Map([["b1", "p1"]]);
let user: { id: string } | null = { id: "u" };
vi.mock("@/lib/auth", () => ({ getCurrentUser: async () => user }));
vi.mock("@/lib/data", () => ({
  getRepository: async () => ({
    getBoq: async (p: string, id: string) => (boqs.get(id) === p ? { id } : null),
    deleteBoq: async (_p: string, id: string) => void boqs.delete(id),
  }),
}));
const { POST } = await import("@/app/api/boq/delete/route");
const call = (body: unknown) => POST(new Request("http://x", { method: "POST", body: JSON.stringify(body) }) as never);

describe("POST /api/boq/delete", () => {
  it("rejects anonymous callers", async () => {
    user = null;
    expect((await call({ projectId: "p1", boqId: "b1" })).status).toBe(401);
    user = { id: "u" };
    expect(boqs.has("b1")).toBe(true);
  });

  it("404s a BOQ that is not in that project, and deletes one that is", async () => {
    expect((await call({ projectId: "other", boqId: "b1" })).status).toBe(404);
    expect(boqs.has("b1")).toBe(true);
    expect((await call({ projectId: "p1", boqId: "b1" })).status).toBe(200);
    expect(boqs.has("b1")).toBe(false);
  });
});
