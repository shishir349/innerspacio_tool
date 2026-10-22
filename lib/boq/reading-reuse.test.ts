import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { deflateSync } from "node:zlib";
import type { BoqScope } from "@/lib/ai/boq-brief";
import { cleoItems, CLEO_ROOMS } from "@/lib/boq/fixtures/cleo-county";

/**
 * Offline check of the reuse fix through the REAL /api/boq/from-brief handler. The paid AI call is replaced by a
 * stub that gives a DIFFERENT reading every time it is called, which is exactly the variance seen in production.
 * Set GODREJ_READINGS to a JSON file of saved BOQ rows to use real saved readings instead of the synthetic ones.
 */

type Rec = { id: string; projectId: string; title: string; payload: Record<string, unknown>; updatedAt: string };
const store = new Map<string, Rec>();
let aiCalls = 0;

const synthetic = (): BoqScope[] => {
  const items = cleoItems("premium");
  const base = { rooms: CLEO_ROOMS, assumptions: [], unpriced: [], questions: [], dropped: [] };
  return [
    { ...base, items },
    { ...base, items: items.slice(0, items.length - 3) },
    { ...base, items: items.slice(0, items.length - 8) },
  ];
};

const real = (path: string): BoqScope[] => {
  const rows = JSON.parse(readFileSync(path, "utf8")) as { id: string; payload: { scope: { items: unknown[] }; planRooms: Record<string, unknown>[] } }[];
  return ["b1df3675", "1d8ba8fc", "0fd78bd1"].map((p) => {
    const b = rows.find((r) => r.id.startsWith(p))!;
    return {
      rooms: b.payload.planRooms.map((r, i) => ({ ...r, id: (r.id as string) ?? `r${i}` })),
      items: b.payload.scope.items,
      assumptions: [], unpriced: [], questions: [], dropped: [],
    } as unknown as BoqScope;
  });
};

const READINGS = process.env.GODREJ_READINGS ? real(process.env.GODREJ_READINGS) : synthetic();

vi.mock("@/lib/auth", () => ({ getCurrentUser: async () => ({ id: "designer-1" }) }));
vi.mock("@/lib/rate-limit", () => ({ enforceRateLimit: async () => {}, RateLimitedError: class extends Error {} }));
vi.mock("@/lib/ai/boq-provider", () => ({ getBoqProvider: () => "anthropic" }));
vi.mock("@/lib/ai/boq-brief", async (orig) => ({
  ...(await orig<typeof import("@/lib/ai/boq-brief")>()),
  extractBoqScope: async () => READINGS[aiCalls++ % READINGS.length],
}));
vi.mock("@/lib/data", () => ({
  getRepository: async () => ({
    findBoqByReading: async (hash: string) =>
      [...store.values()].filter((b) => (b.payload.reading as { hash?: string } | undefined)?.hash === hash).at(-1) ?? null,
  }),
}));

const { POST: fromBrief } = await import("@/app/api/boq/from-brief/route");

// A valid 400x400 grey PNG built in place: the route checks the signature and a minimum size.
const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf: Buffer) => {
  let c = 0xffffffff;
  for (const byte of buf) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type: string, data: Buffer) => {
  const body = Buffer.concat([Buffer.from(type), data]);
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
};
const makePng = (size: number) => {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth; colour type 0 = greyscale
  const raw = Buffer.alloc((size + 1) * size, 128);
  for (let y = 0; y < size; y++) raw[y * (size + 1)] = 0; // filter byte per row
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
};
const PNG = makePng(400);
const request = (extra: Record<string, string> = {}) => {
  const fd = new FormData();
  fd.append("plan", new File([PNG], "plan.png", { type: "image/png" }));
  fd.append("requirements", "1. Entrance\n- Main door to be painted.\n2. Master bedroom: wardrobe and dresser");
  fd.append("tier", "premium");
  fd.append("city", "Noida");
  for (const [k, v] of Object.entries(extra)) fd.append(k, v);
  return new Request("http://x/api/boq/from-brief", { method: "POST", body: fd }) as never;
};
const run = async (extra?: Record<string, string>) => {
  const res = await fromBrief(request(extra));
  expect(res.status).toBe(200);
  return (await res.json()) as { total: number; reused?: { title: string }; reading: { hash: string }; summary: { total: number } };
};
/** What saving does: keep the pristine reading with the BOQ. */
const save = (r: Awaited<ReturnType<typeof run>>, title: string) =>
  store.set(title, { id: title, projectId: "p", title, updatedAt: new Date().toISOString(), payload: { reading: { hash: r.reading.hash, source: "ai", at: "t", scope: (r.reading as unknown as { scope: unknown }).scope } } });

beforeEach(() => {
  store.clear();
  aiCalls = 0;
});

describe("identical inputs through /api/boq/from-brief", () => {
  it("BEFORE any save, parallel runs are independent AI reads and differ (the AI is the variable step)", async () => {
    const out = await Promise.all([run(), run(), run()]);
    const totals = out.map((o) => Math.round(o.summary.total));
    console.log("PARALLEL, nothing saved:", totals, "AI calls:", aiCalls);
    expect(aiCalls).toBe(3);
    expect(new Set(totals).size).toBeGreaterThan(1);
  });

  it("AFTER the first reading is saved, parallel runs reuse it and give identical totals", async () => {
    const first = await run();
    save(first, "BOQ 1");
    const callsAfterFirst = aiCalls;
    const rest = await Promise.all([run(), run(), run()]);
    const totals = [first, ...rest].map((o) => Math.round(o.summary.total));
    console.log("FIRST then 3 parallel:", totals, "extra AI calls:", aiCalls - callsAfterFirst);
    expect(aiCalls).toBe(callsAfterFirst);
    expect(rest.every((r) => r.reused?.title === "BOQ 1")).toBe(true);
    expect(new Set(totals).size).toBe(1);
  });

  it("'Read the plan again' bypasses the stored reading and asks the AI", async () => {
    const first = await run();
    save(first, "BOQ 1");
    const again = await run({ fresh: "1" });
    expect(again.reused).toBeUndefined();
    expect(aiCalls).toBe(2);
  });

  it("a change in the requirement words is a new input and is read afresh", async () => {
    const first = await run();
    save(first, "BOQ 1");
    const fd = new FormData();
    fd.append("plan", new File([PNG], "plan.png", { type: "image/png" }));
    fd.append("requirements", "1. Entrance\n- Main door to be polished.");
    fd.append("tier", "premium");
    const res = await fromBrief(new Request("http://x", { method: "POST", body: fd }) as never);
    expect((await res.json()).reused).toBeUndefined();
    expect(aiCalls).toBe(2);
  });
});
