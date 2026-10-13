import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OpenAIImageGenerationProvider } from "./openai-provider";
import type { ConceptGenerationRequest } from "@/lib/image-gen/types";

// All OpenAI calls are mocked at the `fetch` boundary — these tests never
// make a real network request and never incur API charges.

const baseRequest: ConceptGenerationRequest = {
  referencePhotoUrl: "data:image/jpeg;base64,/9j/4AAQSkZJRg==",
  roomName: "Living Room",
  roomType: "Living Room",
  style: "Warm Minimal",
  brief: "Pastel blues, lots of concealed storage",
  variantCount: 2,
};

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

describe("OpenAIImageGenerationProvider", () => {
  const originalApiKey = process.env.OPENAI_API_KEY;
  const originalModel = process.env.OPENAI_IMAGE_MODEL;

  beforeEach(() => {
    process.env.OPENAI_API_KEY = "sk-test-key";
    delete process.env.OPENAI_IMAGE_MODEL;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    if (originalApiKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = originalApiKey;
    if (originalModel === undefined) delete process.env.OPENAI_IMAGE_MODEL;
    else process.env.OPENAI_IMAGE_MODEL = originalModel;
  });

  it("throws immediately when OPENAI_API_KEY is not configured, without calling fetch", async () => {
    delete process.env.OPENAI_API_KEY;
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const provider = new OpenAIImageGenerationProvider();

    await expect(provider.generateConcepts(baseRequest)).rejects.toThrow(/OPENAI_API_KEY/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends the reference image as raw bytes (multipart), never as a URL string", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(200, { data: [{ b64_json: "aGVsbG8=" }, { b64_json: "d29ybGQ=" }] })
    );
    vi.stubGlobal("fetch", fetchMock);
    const provider = new OpenAIImageGenerationProvider();

    await provider.generateConcepts(baseRequest);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.openai.com/v1/images/edits");
    expect(init.body).toBeInstanceOf(FormData);
    const form = init.body as FormData;
    const image = form.get("image");
    expect(image).toBeInstanceOf(Blob);
    expect(typeof image).not.toBe("string");
  });

  it("never sends response_format (gpt-image-1 rejects it)", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { data: [{ b64_json: "aGVsbG8=" }] }));
    vi.stubGlobal("fetch", fetchMock);
    const provider = new OpenAIImageGenerationProvider();

    await provider.generateConcepts(baseRequest);

    const form = fetchMock.mock.calls[0][1].body as FormData;
    expect(form.get("response_format")).toBeNull();
  });

  it("sends a valid `size` enum value and the clamped variant count as `n`", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(200, { data: [{ b64_json: "aGVsbG8=" }, { b64_json: "d29ybGQ=" }] })
    );
    vi.stubGlobal("fetch", fetchMock);
    const provider = new OpenAIImageGenerationProvider();

    await provider.generateConcepts(baseRequest);

    const form = fetchMock.mock.calls[0][1].body as FormData;
    expect(["1024x1024", "1536x1024", "1024x1536", "auto"]).toContain(form.get("size"));
    expect(form.get("n")).toBe("2");
  });

  it("clamps an oversized variantCount to MAX_VARIANTS_PER_REQUEST", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { data: [{ b64_json: "aGVsbG8=" }] }));
    vi.stubGlobal("fetch", fetchMock);
    const provider = new OpenAIImageGenerationProvider();

    await provider.generateConcepts({ ...baseRequest, variantCount: 99 });

    const form = fetchMock.mock.calls[0][1].body as FormData;
    expect(Number(form.get("n"))).toBeLessThanOrEqual(4);
  });

  it("parses multiple returned images into separate, labeled results", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(200, { data: [{ b64_json: "aGVsbG8=" }, { b64_json: "d29ybGQ=" }] })
    );
    vi.stubGlobal("fetch", fetchMock);
    const provider = new OpenAIImageGenerationProvider();

    const results = await provider.generateConcepts(baseRequest);

    expect(results).toHaveLength(2);
    expect(results[0].imageUrl).toBe("data:image/png;base64,aGVsbG8=");
    expect(results[1].imageUrl).toBe("data:image/png;base64,d29ybGQ=");
    expect(results[0].title).not.toBe(results[1].title);
    results.forEach((r) => {
      expect(r.status).toBe("generated");
      expect(r.provider).toBe("openai");
    });
  });

  it("skips malformed entries individually instead of failing the whole batch", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(200, { data: [{ b64_json: "aGVsbG8=" }, {}] })
    );
    vi.stubGlobal("fetch", fetchMock);
    const provider = new OpenAIImageGenerationProvider();

    const results = await provider.generateConcepts(baseRequest);
    expect(results).toHaveLength(1);
  });

  it("does not claim success when the provider returns no usable image data", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { data: [{}] }));
    vi.stubGlobal("fetch", fetchMock);
    const provider = new OpenAIImageGenerationProvider();

    await expect(provider.generateConcepts(baseRequest)).rejects.toThrow(/no usable image data/);
  });

  it("surfaces a content-policy rejection with a clear, actionable message", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(400, { error: { code: "content_policy_violation", message: "flagged" } })
    );
    vi.stubGlobal("fetch", fetchMock);
    const provider = new OpenAIImageGenerationProvider();

    await expect(provider.generateConcepts(baseRequest)).rejects.toThrow(/content policy/i);
  });

  it("surfaces a billing/quota rejection distinctly from a generic failure", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(429, { error: { type: "insufficient_quota", message: "no quota" } })
    );
    vi.stubGlobal("fetch", fetchMock);
    const provider = new OpenAIImageGenerationProvider();

    await expect(provider.generateConcepts(baseRequest)).rejects.toThrow(/billing|quota|limit/i);
  });

  it("surfaces an auth rejection distinctly from a generic failure", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(401, { error: { message: "bad key" } }));
    vi.stubGlobal("fetch", fetchMock);
    const provider = new OpenAIImageGenerationProvider();

    await expect(provider.generateConcepts(baseRequest)).rejects.toThrow(/API key/i);
  });

  it("surfaces a timeout distinctly from a generic failure", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new DOMException("aborted", "AbortError"));
    vi.stubGlobal("fetch", fetchMock);
    const provider = new OpenAIImageGenerationProvider();

    await expect(provider.generateConcepts(baseRequest)).rejects.toThrow(/timed out/i);
  });

  it("uses OPENAI_IMAGE_MODEL when set, defaulting to gpt-image-1 otherwise", async () => {
    process.env.OPENAI_IMAGE_MODEL = "gpt-image-1-mini";
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { data: [{ b64_json: "aGVsbG8=" }] }));
    vi.stubGlobal("fetch", fetchMock);
    const provider = new OpenAIImageGenerationProvider();

    await provider.generateConcepts(baseRequest);

    const form = fetchMock.mock.calls[0][1].body as FormData;
    expect(form.get("model")).toBe("gpt-image-1-mini");
  });
});
