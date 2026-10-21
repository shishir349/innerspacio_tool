import type { BriefItem } from "@/lib/boq/brief";
import { tierGrade } from "@/lib/boq/build";
import type { PackageTier } from "@/lib/quote/constants";

/**
 * Server-side guard on what the AI picks for loose furniture and bathroom fittings. The model is told the tier's
 * grade and to price only what the brief names, but it does not always obey (a premium run came back all-luxury with
 * chairs and tables nobody asked for). So the server (1) forces the tier's grade onto `lf:` / `bth:` ids and
 * (2) drops a furniture piece whose quoted requirement never mentions that kind of furniture. Dropped pieces are
 * reported, never silent.
 */

/** Words that must appear in the quoted requirement for each furniture code (the two digits after the grade letter). */
const NAMES: Record<string, RegExp> = {
  "01": /sofa|couch|seater/,
  "02": /chair/,
  "03": /coffee|centre table|center table/,
  "04": /side table|end table|bedside/,
  "05": /dining/,
  "06": /dining/,
  "07": /\bbeds?\b/,
  "08": /\bbeds?\b/,
  "09": /mattress/,
  "10": /bedside|side table|night ?stand/,
  "11": /desk|study/,
  "12": /chair/,
  "13": /bench|shoe/,
  "14": /\btv\b|console|television/,
  "15": /sideboard|crockery|buffet/,
};
const SOFA_ALLOWANCE = /^al:SOFA/;
const LF = /^lf:LF[BEL](\d\d)$/;
const GRADE_WORD = { LFB: "basic", LFE: "elevated", LFL: "luxury" } as const;

export function guardFurniture(items: BriefItem[], tier: PackageTier): { items: BriefItem[]; warnings: string[] } {
  const { lf, bath } = tierGrade(tier);
  const warnings: string[] = [];
  const out: BriefItem[] = [];
  for (const it of items) {
    const id = it.rateId ?? "";
    const m = LF.exec(id);
    let next = it;
    if (m) {
      const want = `lf:${lf}${m[1]}`;
      if (id !== want) {
        // The line title must not keep saying "luxury" once it bills the tier's grade.
        next = { ...it, rateId: want, ...(it.title ? { title: it.title.replace(/\b(basic|elevated|luxury)\b/gi, GRADE_WORD[lf]) } : {}) };
        warnings.push(`${it.room}: “${id}” changed to ${want}: the ${tier} tier uses the ${lf} furniture grade.`);
      }
    } else if (/^bth:BTH0[12]$/.test(id) && id !== bath) {
      next = { ...it, rateId: bath };
      warnings.push(`${it.room}: ${id} changed to ${bath}: the ${tier} tier's bathroom package.`);
    }

    const code = m?.[1];
    const quoted = it.requirement.toLowerCase();
    const named = code ? NAMES[code] : SOFA_ALLOWANCE.test(id) ? NAMES["01"] : undefined;
    if (quoted.trim() && named && !named.test(quoted)) {
      warnings.push(`${it.room}: dropped “${next.title ?? next.rateId}”: the brief line “${it.requirement.slice(0, 70)}” does not ask for it. Add it by hand if wanted.`);
      continue;
    }
    out.push(next);
  }
  return { items: out, warnings };
}
