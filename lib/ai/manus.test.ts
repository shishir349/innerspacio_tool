import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createManusTask, extractJsonObject, getManusTask, interpretMessages } from "@/lib/ai/manus";
import { AIConfigurationError, AIRequestError, AIValidationError } from "@/lib/ai/errors";

const status = (agent_status: string, extra: object = {}) => ({
  type: "status_update",
  status_update: { agent_status, ...extra },
});
const say = (content: string, delivery_kind = "result") => ({
  type: "assistant_message",
  assistant_message: { content, delivery_kind },
});

describe("interpretMessages", () => {
  it("no status yet / running / waiting-to-start are in progress", () => {
    expect(interpretMessages([]).state).toBe("running");
    expect(interpretMessages([status("running"), say("opening", "opening")]).state).toBe("running");
  });

  it("stopped returns the result message, not the opening chatter", () => {
    const r = interpretMessages([
      status("running"),
      say("I will start", "opening"),
      say('{"rooms":[]}', "result"),
      status("stopped"),
    ]);
    expect(r).toEqual({ state: "completed", text: '{"rooms":[]}' });
  });

  it("falls back to the last assistant message when none is marked result", () => {
    const r = interpretMessages([status("running"), say("hello", "opening"), say("final", "other"), status("stopped")]);
    expect(r).toEqual({ state: "completed", text: "final" });
  });

  it("error surfaces a short message; waiting does not hang", () => {
    expect(interpretMessages([status("error", { error_message: "boom" })])).toMatchObject({ state: "failed", error: "boom" });
    expect(interpretMessages([status("running"), status("waiting")]).state).toBe("failed");
  });

  it("stopped with no reply is a failure, not an empty success", () => {
    expect(interpretMessages([status("running"), status("stopped")]).state).toBe("failed");
  });
});

describe("extractJsonObject", () => {
  it("parses plain JSON, fenced JSON, and JSON surrounded by prose", () => {
    expect(extractJsonObject('{"a":1}')).toEqual({ a: 1 });
    expect(extractJsonObject('Here you go:\n```json\n{"a":2}\n```\nDone.')).toEqual({ a: 2 });
    expect(extractJsonObject('Result {"a":{"b":3}} thanks')).toEqual({ a: { b: 3 } });
  });

  it("throws a validation error when there is no JSON or it is broken", () => {
    expect(() => extractJsonObject("no json here")).toThrow(AIValidationError);
    expect(() => extractJsonObject("{ not: json }")).toThrow(AIValidationError);
  });
});

describe("Manus HTTP client", () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    process.env.MANUS_API_KEY = "test-key";
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.MANUS_API_KEY;
  });

  const json = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

  it("creates a task with the API_KEY header and a hidden, non-interactive agent task", async () => {
    fetchMock.mockResolvedValue(json(200, { task_id: "abc123" }));
    const id = await createManusTask({ prompt: "p", attachments: [{ filename: "a.png", fileData: "data:image/png;base64,AA" }] });
    expect(id).toBe("abc123");
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toMatch(/\/v1\/tasks$/);
    expect(init.headers.API_KEY).toBe("test-key");
    const body = JSON.parse(init.body);
    expect(body).toMatchObject({ prompt: "p", hideInTaskList: true, interactiveMode: false });
    expect(body.attachments[0].filename).toBe("a.png");
  });

  it("reads task messages through v2 with the x-manus-api-key header", async () => {
    fetchMock.mockResolvedValue(
      json(200, { messages: [status("running"), say('{"rooms":[]}'), status("stopped")] })
    );
    const r = await getManusTask("abc123");
    expect(r).toEqual({ state: "completed", text: '{"rooms":[]}' });
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toMatch(/\/v2\/task\.listMessages\?task_id=abc123/);
    expect(init.headers["x-manus-api-key"]).toBe("test-key");
    expect(init.headers.API_KEY).toBeUndefined();
  });

  it("maps a rejected key to a configuration error", async () => {
    fetchMock.mockResolvedValue(json(401, { message: "invalid token" }));
    await expect(getManusTask("abc123")).rejects.toBeInstanceOf(AIConfigurationError);
  });

  it("maps 429 to rate_limited and hides upstream error text", async () => {
    fetchMock.mockResolvedValueOnce(json(429, {}));
    await expect(getManusTask("abc123")).rejects.toMatchObject({ code: "rate_limited" });
    fetchMock.mockResolvedValueOnce(json(500, { message: "internal secret detail" }));
    const e = await getManusTask("abc123").catch((x) => x);
    expect(e).toBeInstanceOf(AIRequestError);
    expect(e.message).not.toMatch(/secret/);
  });

  it("errors clearly when no key is set", async () => {
    delete process.env.MANUS_API_KEY;
    await expect(getManusTask("abc123")).rejects.toBeInstanceOf(AIConfigurationError);
  });
});
