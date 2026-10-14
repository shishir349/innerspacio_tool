import { beforeEach, describe, expect, it, vi } from "vitest";

const create = vi.fn();

vi.mock("@anthropic-ai/sdk", () => {
  class APIError extends Error {
    constructor(readonly status: number, message: string) {
      super(message);
    }
  }
  class AuthenticationError extends APIError {}
  class PermissionDeniedError extends APIError {}
  class NotFoundError extends APIError {}
  class RateLimitError extends APIError {}
  class APIConnectionTimeoutError extends Error {}
  class Anthropic {
    static APIError = APIError;
    static AuthenticationError = AuthenticationError;
    static PermissionDeniedError = PermissionDeniedError;
    static NotFoundError = NotFoundError;
    static RateLimitError = RateLimitError;
    static APIConnectionTimeoutError = APIConnectionTimeoutError;
    messages = { create };
  }
  return { default: Anthropic };
});

vi.mock("@/lib/config", () => ({
  isAnthropicConfigured: () => true,
  getAnthropicModel: () => "test-model",
}));

import Anthropic from "@anthropic-ai/sdk";
import { extractBoqScope } from "@/lib/ai/boq-brief";
import { AIConfigurationError, AIRequestError, AIValidationError } from "@/lib/ai/errors";

const args = {
  plan: { data: "AAAA", mediaType: "image/png" as const },
  photos: [],
  requirements: "Paint the main door",
  tier: "premium" as const,
};

const Errs = Anthropic as unknown as Record<string, new (s: number, m: string) => Error>;

const toolUse = (input: unknown) => ({ content: [{ type: "tool_use", name: "submit_boq_scope", input }] });

beforeEach(() => create.mockReset());

describe("extractBoqScope", () => {
  it("a rejected API key becomes an actionable configuration error", async () => {
    create.mockImplementationOnce(async () => {
      throw new Errs.AuthenticationError(401, "invalid x-api-key");
    });
    const e = await extractBoqScope(args).catch((x: unknown) => x);
    expect(e).toBeInstanceOf(AIConfigurationError);
    expect((e as Error).message).toMatch(/ANTHROPIC_API_KEY/);
  });

  it("an unknown model is a configuration error naming the model", async () => {
    create.mockImplementationOnce(async () => {
      throw new Errs.NotFoundError(404, "model");
    });
    const e = await extractBoqScope(args).catch((x: unknown) => x);
    expect(e).toBeInstanceOf(AIConfigurationError);
    expect((e as Error).message).toMatch(/test-model/);
  });

  it("rate limit and other failures stay request errors", async () => {
    create.mockImplementationOnce(async () => {
      throw new Errs.RateLimitError(429, "slow down");
    });
    await expect(extractBoqScope(args)).rejects.toMatchObject({ code: "rate_limited" });
    create.mockImplementationOnce(async () => {
      throw new Error("boom");
    });
    const e = await extractBoqScope(args).catch((x) => x);
    expect(e).toBeInstanceOf(AIRequestError);
    expect(e.message).not.toMatch(/boom/); // upstream text is not leaked
  });

  it("drops invalid rooms/items, keeps valid ones, caps strings", async () => {
    create.mockResolvedValue(
      toolUse({
        rooms: [
          { id: "a", name: "Master", boqRoom: "Master Bedroom", l: 12, b: 14, h: 10, source: "labelled" },
          { id: "b", name: "Bad", boqRoom: "Master Bedroom", l: -5, b: 4, h: 10, source: "labelled" },
        ],
        items: [
          { room: "Master Bedroom", requirement: "paint", kind: "rate", rateId: "pt:PT03", basis: "wall_area" },
          { room: "Master Bedroom", requirement: "x", kind: "rate", basis: "bogus" },
        ],
        assumptions: ["a".repeat(900), 5],
        unpriced: [{ requirement: 5 }, null, { requirement: "x" }],
        questions: [],
      })
    );
    const r = await extractBoqScope(args);
    expect(r.rooms).toHaveLength(1);
    expect(r.items).toHaveLength(1);
    expect(r.dropped).toHaveLength(2);
    expect(r.assumptions).toEqual(["a".repeat(300)]);
    expect(r.unpriced).toEqual([{ requirement: "x", reason: "" }]);
  });

  it("rejects when no usable room was read", async () => {
    create.mockResolvedValue(toolUse({ rooms: [], items: [], assumptions: [], unpriced: [], questions: [] }));
    await expect(extractBoqScope(args)).rejects.toBeInstanceOf(AIValidationError);
  });

  it("rejects a response without the tool call", async () => {
    create.mockResolvedValue({ content: [{ type: "text", text: "hi" }] });
    await expect(extractBoqScope(args)).rejects.toBeInstanceOf(AIValidationError);
  });
});
