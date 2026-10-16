import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import sharp from "sharp";
import { getAnthropicModel, isAnthropicConfigured } from "@/lib/config";

const MAX_NOTES = 700;

/**
 * One cheap vision call: list the fixed, un-changeable elements of a room photo
 * (doors, windows, openings, ceiling, built-ins) so the image prompt can name
 * them. Best-effort: returns undefined on any failure or when no key is set, and
 * the generic structure lock in the prompt still applies. Text is capped and
 * only ever appended to an image prompt — it is never shown or acted on.
 */
export async function describeStructure(photo: Buffer): Promise<string | undefined> {
  if (!isAnthropicConfigured()) return undefined;
  try {
    // Downscale + normalise to JPEG: keeps the call cheap and under the vision size limit.
    const jpeg = await sharp(photo).rotate().resize(1280, 1280, { fit: "inside" }).jpeg({ quality: 80 }).toBuffer();
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: 25_000 });
    const res = await client.messages.create({
      model: process.env.ANTHROPIC_STRUCTURE_MODEL || getAnthropicModel(),
      max_tokens: 300,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: "image/jpeg", data: jpeg.toString("base64") },
            },
            {
              type: "text",
              text: "List ONLY the fixed, permanent elements of this room that must not change in a redesign: every door (state open/closed, which wall, left/centre/right), every window, archway or opening, niche, column, beam, staircase, AC unit, ceiling height impression (low/normal/high, any slab step or beam) and the room shape. One short phrase each, separated by semicolons, max 90 words. No furniture, no styling advice, no preamble.",
            },
          ],
        },
      ],
    });
    const text = res.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    return text ? text.slice(0, MAX_NOTES) : undefined;
  } catch {
    return undefined;
  }
}
