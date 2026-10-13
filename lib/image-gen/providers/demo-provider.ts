import type {
  ConceptGenerationRequest,
  GeneratedConceptResult,
  ImageGenerationProvider,
} from "@/lib/image-gen/types";

// A small set of restrained, on-brand palettes so demo concepts still look
// intentional rather than randomly generated.
const PALETTES: { bg: string; accent: string; ink: string }[] = [
  { bg: "#F3EBDD", accent: "#8C7A56", ink: "#3A362F" },
  { bg: "#EDE7DC", accent: "#58624E", ink: "#2A2824" },
  { bg: "#F1E7DA", accent: "#B08D57", ink: "#3A362F" },
  { bg: "#E9E2D6", accent: "#6B7A63", ink: "#2A2824" },
];

function hashString(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Builds an inline SVG placeholder — explicitly labeled as a demo, never
 * presented as an AI-generated rendering of the client's room. This keeps
 * demo mode honest: no stock photography is shown as though it were a
 * redesign of the uploaded photo.
 */
function buildPlaceholderSvg(title: string, style: string): string {
  const palette = PALETTES[hashString(title + style) % PALETTES.length];
  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="768" viewBox="0 0 1024 768">
  <rect width="1024" height="768" fill="${palette.bg}" />
  <rect x="48" y="48" width="928" height="672" fill="none" stroke="${palette.accent}" stroke-width="2" rx="18" />
  <circle cx="512" cy="300" r="120" fill="${palette.accent}" opacity="0.18" />
  <rect x="392" y="360" width="240" height="160" fill="${palette.accent}" opacity="0.25" rx="10" />
  <text x="512" y="560" font-family="Georgia, serif" font-size="34" fill="${palette.ink}" text-anchor="middle">${escapeXml(title)}</text>
  <text x="512" y="600" font-family="Arial, sans-serif" font-size="18" fill="${palette.ink}" text-anchor="middle" opacity="0.75">${escapeXml(style)}</text>
  <text x="512" y="672" font-family="Arial, sans-serif" font-size="16" letter-spacing="2" fill="${palette.ink}" text-anchor="middle" opacity="0.6">DEMO CONCEPT — ILLUSTRATIVE PLACEHOLDER, NOT GENERATED FROM YOUR PHOTO</text>
</svg>`.trim();
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

const STYLE_VARIANTS: { suffix: string; changes: string[] }[] = [
  {
    suffix: "— Warm Minimal",
    changes: [
      "Lighter wall tone with a single warm accent wall",
      "Streamlined furniture silhouettes, fewer but better pieces",
      "Layered lighting: ambient + task + accent",
    ],
  },
  {
    suffix: "— Textured Contemporary",
    changes: [
      "Mixed natural materials: wood tones with matte stone accents",
      "Concealed/integrated storage to reduce visual clutter",
      "Soft furnishings in a tonal, muted palette",
    ],
  },
  {
    suffix: "— Classic Refresh",
    changes: [
      "Refined trims and clean sightlines",
      "Upgraded fixtures and hardware finishes",
      "Improved natural light with lighter window treatments",
    ],
  },
];

export class DemoImageGenerationProvider implements ImageGenerationProvider {
  readonly name = "demo";
  readonly isDemo = true;

  async generateConcepts(request: ConceptGenerationRequest): Promise<GeneratedConceptResult[]> {
    const count = Math.max(1, request.variantCount);
    const results: GeneratedConceptResult[] = [];

    for (let i = 0; i < count; i++) {
      const variant = STYLE_VARIANTS[(hashString(request.brief + request.style) + i) % STYLE_VARIANTS.length];
      const title = `${request.style} ${variant.suffix}`;
      const paletteNote = request.palette ? ` Palette focus: ${request.palette}.` : "";
      const description = `Illustrative demo concept for the ${request.roomName.toLowerCase()}, exploring a ${request.style.toLowerCase()} direction.${paletteNote} ${request.brief} No image-generation provider is configured, so this is a labeled placeholder rather than a rendering of your actual room — configure IMAGE_GENERATION_PROVIDER and its API key to generate real concept visuals from the uploaded photo.`;

      results.push({
        imageUrl: buildPlaceholderSvg(`${title}${count > 1 ? ` (${i + 1}/${count})` : ""}`, request.style),
        title: count > 1 ? `${title} — Variant ${i + 1}` : title,
        style: request.style,
        description,
        keyChanges: variant.changes,
        provider: "demo",
        status: "demo",
      });
    }

    return results;
  }
}
