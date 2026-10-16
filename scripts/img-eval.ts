/**
 * Paid image-prompt evaluation. Runs the real OpenAI edit endpoint on sample photos and
 * writes before/after PNGs to the out dir. Hard cost cap. Needs OPENAI_API_KEY in .env.local.
 *
 *   npx tsx --conditions react-server scripts/img-eval.ts <outDir> <oldBuilderPath> case1,case2
 */
import fs from "node:fs";
import path from "node:path";
import { OpenAIImageGenerationProvider } from "@/lib/image-gen/providers/openai-provider";
import { buildConceptEditInstruction } from "@/lib/image-gen/prompt-builder";
import { describeStructure } from "@/lib/ai/structure";

try { process.loadEnvFile(".env.local"); } catch {}
const CAP_USD = 0.3;
const SAMPLES = "Img_Samples";
const CASES: Record<string, { file: string; roomType: string; style: string; ideas: string; quality: string; compareOld: boolean }> = {
  bath: { file: "06 Washroom/Washroom_P03-Cosmopolitan-Clubs-Gurugram_p28_04.jpg", roomType: "bathroom", style: "Refined contemporary interior with quality woodwork, layered lighting and premium finishes", ideas: "", quality: "low", compareOld: true },
  shell: { file: "16 Site Progress Photos/Site_P05-Residential-Project-Sector-108_p40_02.jpg", roomType: "bedroom", style: "Refined contemporary interior with quality woodwork, layered lighting and premium finishes", ideas: "calm, lots of wardrobe storage", quality: "medium", compareOld: false },
  bed: { file: "02 Bedroom/Bedroom_P04-Apex-Alphabet_p35_02.jpg", roomType: "bedroom", style: "Luxurious bespoke interior with high-end materials, statement lighting, rich textures and custom joinery", ideas: "Blue and grey tones, big wardrobe", quality: "medium", compareOld: false },
};

async function main() {
  const [outDir, oldPath, names] = process.argv.slice(2);
  fs.mkdirSync(outDir, { recursive: true });
  const oldBuilder = oldPath && fs.existsSync(oldPath) ? ((await import(path.resolve(oldPath))) as { buildConceptEditInstruction: typeof buildConceptEditInstruction }) : null;
  let spent = 0;
  const price = (u: { input_tokens_details?: { text_tokens?: number; image_tokens?: number }; output_tokens?: number }) =>
    ((u.input_tokens_details?.text_tokens ?? 0) * 5 + (u.input_tokens_details?.image_tokens ?? 0) * 10 + (u.output_tokens ?? 0) * 40) / 1e6;
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (...a: Parameters<typeof fetch>) => {
    const r = await realFetch(...a);
    if (String(a[0]).includes("images/edits") && r.ok) {
      const j = (await r.clone().json()) as { usage?: Parameters<typeof price>[0] };
      if (j.usage) { spent += price(j.usage); console.log(`   spent so far $${spent.toFixed(3)}`); }
    }
    return r;
  }) as typeof fetch;

  for (const name of (names || "").split(",").filter(Boolean)) {
    const c = CASES[name];
    const buf = fs.readFileSync(path.join(SAMPLES, c.file));
    const dataUrl = `data:image/jpeg;base64,${buf.toString("base64")}`;
    fs.writeFileSync(path.join(outDir, `${name}_0_input.jpg`), buf);
    const structureNotes = await describeStructure(buf);
    console.log(name, "structure:", structureNotes ?? "(none)");
    const variants: [string, string, string][] = [["new", buildConceptEditInstruction({ roomType: c.roomType as never, style: c.style, userBrief: c.ideas, structureNotes }), "high"]];
    if (c.compareOld && oldBuilder) variants.unshift(["old", oldBuilder.buildConceptEditInstruction({ roomType: c.roomType as never, style: c.style, userBrief: c.ideas }), "low"]);
    for (const [tag, brief, fid] of variants) {
      if (spent > CAP_USD - 0.1) { console.log("cap reached, skipping", name, tag); continue; }
      process.env.OPENAI_IMAGE_QUALITY = c.quality;
      process.env.OPENAI_INPUT_FIDELITY = fid;
      const out = await new OpenAIImageGenerationProvider().generateConcepts({ referencePhotoUrl: dataUrl, roomName: c.roomType, roomType: c.roomType, style: c.style, brief, variantCount: 1 });
      const b64 = out[0].imageUrl.split(",")[1];
      fs.writeFileSync(path.join(outDir, `${name}_${tag}.png`), Buffer.from(b64, "base64"));
      fs.writeFileSync(path.join(outDir, `${name}_${tag}_prompt.txt`), brief);
      console.log("wrote", name, tag);
    }
  }
  console.log(`TOTAL $${spent.toFixed(3)}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
