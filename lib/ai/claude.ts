import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { getAnthropicModel, isAnthropicConfigured } from "@/lib/config";
import { roomAnalysisContentSchema } from "@/lib/ai/schemas";
import { AIConfigurationError, AIRequestError, AIValidationError } from "@/lib/ai/errors";
import type { RoomAnalysis, RoomType } from "@/lib/types";

const MAX_PHOTOS_PER_ANALYSIS = 5;
const REQUEST_TIMEOUT_MS = 60_000;

const ANALYSIS_TOOL_NAME = "submit_room_analysis";

const ANALYSIS_TOOL: Anthropic.Tool = {
  name: ANALYSIS_TOOL_NAME,
  description:
    "Submit a structured analysis of the uploaded interior room photograph(s) for an Indian residential redesign project.",
  input_schema: {
    type: "object",
    properties: {
      observedRoomType: {
        type: "string",
        description: "The room type as observed from the photo(s), in plain words.",
      },
      visibleArchitecturalFeatures: {
        type: "array",
        items: { type: "string" },
        description: "Observed architectural features — ceiling height/shape, alcoves, beams, niches, built-in elements, etc.",
      },
      visibleDoorsWindowsFixtures: {
        type: "array",
        items: { type: "string" },
        description: "Observed doors, windows and any other fixed (non-movable) fixtures, with their approximate position in the room.",
      },
      existingFurnitureAndStorage: {
        type: "array",
        items: { type: "string" },
        description: "Furniture and storage currently visible in the room.",
      },
      approximateVisualStyle: {
        type: "string",
        description: "The room's current approximate visual style, in plain words (e.g. \"traditional with some contemporary pieces\").",
      },
      colorPalette: {
        type: "array",
        items: { type: "string" },
        description: "The dominant colours currently visible in the room.",
      },
      lightingConditions: {
        type: "string",
        description: "Observed natural and artificial lighting — window orientation/light level if inferable, visible fixtures, overall brightness.",
      },
      visibleMaterialsAndFinishes: {
        type: "array",
        items: { type: "string" },
        description: "Visible materials and finishes — flooring, wall finish, countertop material, etc.",
      },
      existingLayoutDescription: {
        type: "string",
        description: "An objective description of the room's current layout and spatial flow — not a list of problems, just what's there.",
      },
      designOpportunities: { type: "array", items: { type: "string" } },
      potentialConstraints: {
        type: "array",
        items: { type: "string" },
        description: "Constraints that are directly visible or clearly inferable from the photo (e.g. a narrow doorway, a low beam, a fixed window position) — distinct from things that simply can't be determined from a photo at all.",
      },
      uncertaintiesRequiringSiteVisit: {
        type: "array",
        items: { type: "string" },
        description:
          "Things that cannot reliably be determined from photos alone and specifically require a site visit (e.g. exact dimensions, concealed plumbing/electrical routing, structural condition, load-bearing walls). Never state any of these as a fact elsewhere in the analysis.",
      },
      recommendedDesignDirection: { type: "string" },
      suggestedChanges: {
        type: "array",
        items: { type: "string" },
        description: "Suggested furniture, storage, finish and lighting changes.",
      },
      questionsForClient: {
        type: "array",
        items: { type: "string" },
        description: "Questions the designer should ask the client before finalizing a concept.",
      },
      designBrief: { type: "string", description: "A concise design brief, 3-6 sentences." },
      draftRenovationWorkItems: {
        type: "array",
        items: { type: "string" },
        description: "A draft list of potential renovation work items — not a priced estimate.",
      },
      elevateIdeas: {
        type: "array",
        description:
          "6-10 specific ways an interior designer could lift THIS room, each grounded in what is visible. Spread them across effort tiers. Never give prices.",
        items: {
          type: "object",
          properties: {
            title: { type: "string", description: "Short and specific, e.g. \"Cove lighting behind the TV wall\"." },
            why: { type: "string", description: "One sentence: what it fixes or adds in this room." },
            effort: {
              type: "string",
              enum: ["quick_win", "medium", "big"],
              description: "quick_win = styling, lighting, paint, soft furnishings (days). medium = new joinery or a feature wall. big = layout, ceiling, flooring or services change.",
            },
            area: { type: "string", description: "The work category, e.g. Paint & Polish, False Ceiling, Modular Woodwork, Furnishings & Décor, Electrical & AC Works." },
          },
          required: ["title", "why", "effort", "area"],
        },
      },
    },
    required: [
      "observedRoomType",
      "visibleArchitecturalFeatures",
      "visibleDoorsWindowsFixtures",
      "existingFurnitureAndStorage",
      "approximateVisualStyle",
      "colorPalette",
      "lightingConditions",
      "visibleMaterialsAndFinishes",
      "existingLayoutDescription",
      "designOpportunities",
      "potentialConstraints",
      "uncertaintiesRequiringSiteVisit",
      "recommendedDesignDirection",
      "suggestedChanges",
      "questionsForClient",
      "designBrief",
      "draftRenovationWorkItems",
      "elevateIdeas",
    ],
  },
};

export interface RoomPhotoInput {
  url: string;
}

export interface RoomContextInput {
  roomName: string;
  roomType: RoomType;
  dimensionsSummary?: string;
  preferredStyle?: string;
  preferredColorPalette?: string;
  storageRequirements?: string;
  materialPreferences?: string;
  budget?: number;
  constraints?: string;
  existingConditionNotes?: string;
}

function buildPrompt(context: RoomContextInput): string {
  const facts = [
    `Room name: ${context.roomName}`,
    `Room type recorded by the designer: ${context.roomType}`,
    context.dimensionsSummary && `Recorded dimensions: ${context.dimensionsSummary}`,
    context.preferredStyle && `Client's preferred style: ${context.preferredStyle}`,
    context.preferredColorPalette && `Preferred colour palette: ${context.preferredColorPalette}`,
    context.storageRequirements && `Storage requirements: ${context.storageRequirements}`,
    context.materialPreferences && `Material preferences: ${context.materialPreferences}`,
    context.budget && `Client budget for this room: INR ${context.budget}`,
    context.constraints && `Known constraints: ${context.constraints}`,
    context.existingConditionNotes && `Designer's existing-condition notes: ${context.existingConditionNotes}`,
  ].filter(Boolean);

  return `You are assisting an interior design studio in Delhi NCR, India, during a client meeting. Analyze the attached photograph(s) of a client's room.

Context recorded by the designer so far:
${facts.map((f) => `- ${f}`).join("\n")}

Keep three categories of information strictly separate, and never blur them together:
1. OBSERVED FACTS — only what is directly visible in the photograph(s): architectural features, doors/windows/fixed fixtures, existing furniture and storage, colour palette, materials/finishes, lighting, layout.
2. INFERENCE — your design judgement built on top of those observed facts (style read, opportunities, recommended direction, suggested changes). Always grounded in what's visible, clearly a professional opinion rather than a fact.
3. UNCERTAINTY — never invent exact measurements, hidden plumbing or electrical routing, structural condition (e.g. which walls are load-bearing), or anything else a photograph genuinely cannot show. Put these explicitly in uncertaintiesRequiringSiteVisit and questionsForClient rather than guessing a number or a condition.

potentialConstraints is for limitations you can actually SEE in the photo (a narrow doorway, a low beam, a fixed window) — do not put things there that you're actually just guessing at; those belong in uncertaintiesRequiringSiteVisit instead.

elevateIdeas is the "how do we take this room up a level" list: concrete, visible-grounded ideas an interior designer could propose (lighting layers, ceiling and wall treatments, joinery, textiles, art, colour, styling), ranked across quick_win / medium / big. No prices.

Call the ${ANALYSIS_TOOL_NAME} tool exactly once with your full structured analysis.`;
}

function mediaTypeFromUrl(url: string): string {
  const lower = url.toLowerCase();
  if (lower.includes("image/png") || lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  return "image/jpeg";
}

async function fetchImageAsBase64(
  url: string
): Promise<{ data: string; mediaType: string }> {
  if (url.startsWith("data:")) {
    const match = /^data:([^;]+);base64,(.*)$/.exec(url);
    if (!match) throw new AIValidationError(`Unsupported data URL for photo.`);
    return { data: match[2], mediaType: match[1] };
  }
  const response = await fetch(url);
  if (!response.ok) {
    throw new AIRequestError(`Could not fetch room photo (${response.status}).`, "request_failed");
  }
  const contentType = response.headers.get("content-type") || mediaTypeFromUrl(url);
  const buffer = await response.arrayBuffer();
  return { data: Buffer.from(buffer).toString("base64"), mediaType: contentType };
}

export async function analyzeRoomPhotos(
  photos: RoomPhotoInput[],
  context: RoomContextInput
): Promise<RoomAnalysis> {
  if (!isAnthropicConfigured()) {
    throw new AIConfigurationError(
      "ANTHROPIC_API_KEY is not configured. Add it to your environment to enable AI room analysis."
    );
  }
  if (photos.length === 0) {
    throw new AIValidationError("At least one room photograph is required for analysis.");
  }

  const limitedPhotos = photos.slice(0, MAX_PHOTOS_PER_ANALYSIS);
  const imageBlocks = await Promise.all(
    limitedPhotos.map(async (photo) => {
      const { data, mediaType } = await fetchImageAsBase64(photo.url);
      return {
        type: "image" as const,
        source: {
          type: "base64" as const,
          media_type: mediaType as "image/jpeg" | "image/png" | "image/webp" | "image/gif",
          data,
        },
      };
    })
  );

  const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
    timeout: REQUEST_TIMEOUT_MS,
  });

  const model = getAnthropicModel();

  let response: Anthropic.Message;
  try {
    response = await client.messages.create({
      model,
      max_tokens: 2048,
      tools: [ANALYSIS_TOOL],
      tool_choice: { type: "tool", name: ANALYSIS_TOOL_NAME },
      messages: [
        {
          role: "user",
          content: [...imageBlocks, { type: "text", text: buildPrompt(context) }],
        },
      ],
    });
  } catch (error) {
    if (error instanceof Anthropic.APIConnectionTimeoutError) {
      throw new AIRequestError("The AI analysis request timed out. Please try again.", "timeout");
    }
    if (error instanceof Anthropic.RateLimitError) {
      throw new AIRequestError(
        "The AI provider rate-limited this request. Please wait a moment and try again.",
        "rate_limited"
      );
    }
    if (error instanceof Anthropic.APIError) {
      throw new AIRequestError(`AI analysis request failed: ${error.message}`, "request_failed");
    }
    throw new AIRequestError(
      `AI analysis request failed: ${error instanceof Error ? error.message : "unknown error"}`,
      "request_failed"
    );
  }

  const toolUse = response.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === "tool_use" && block.name === ANALYSIS_TOOL_NAME
  );
  if (!toolUse) {
    throw new AIValidationError("The AI response did not include a structured analysis.");
  }

  const parsed = roomAnalysisContentSchema.safeParse(toolUse.input);
  if (!parsed.success) {
    throw new AIValidationError(
      `The AI response failed validation: ${parsed.error.issues.map((i) => i.message).join("; ")}`
    );
  }

  return {
    ...parsed.data,
    generatedAt: new Date().toISOString(),
    model,
  };
}
