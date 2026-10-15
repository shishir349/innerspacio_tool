# BOQ v3 — rate-sheet selector + professional-BOQ parity

Source of truth for "what good looks like": `expected_BOQ/` (Apex Alphabet 4BHK, professional).
Our output for the same brief: `your_BOQ/`.

## 1. Spec

### S1 — Rate sheet is explicit and selectable
- User picks **Spazay** (default, full card) · **Livspace** (NCR MRC, ex-GST) · **Both** (bill Spazay, show Livspace reference + delta).
- Every line records which sheet priced it (`rateSource`); lines with no Livspace equivalent fall back to Spazay and say so.
- The workbook header states the sheet; compare mode adds a Livspace column.
- Livspace PDF is a 128-page wrapped-cell dump; only **hand-verified** equivalents are mapped (no bulk parse → no wrong rupees).

### S2 — Output matches the professional BOQ
Gaps found by diffing `your_BOQ` vs `expected_BOQ` (G = gap, F = fix):

| # | Gap | Fix |
|---|-----|-----|
| G1 | No **Entrance** room (merged into Foyer) | add `Entrance` to room list; prompt tells model to split it |
| G2 | "Line / BOQ Item" is a generic label (`Wall Panelling`); requirement text glued into description | per-line `title` (specific, from the requirement); description = rate-card text + scope note |
| G3 | Companion lines missing: oil-primer under wallpaper, wall repair for feature walls | deterministic companion rules in `quantify()` (wallpaper → PT12 primer) |
| G4 | Repaint not netted for panelled/wallpapered/mirror feature | `wall_area` paint lines subtract feature area in the same room |
| G5 | No-rate items dropped (curtain fabric, nameplate, vertical garden) | provisional **allowances** (rates from expected BOQ), flagged `provisional`, "RATE NOT IN CARD" text |
| G6 | Over-scope: full-room demolition + false ceiling for "renovate", floor protection on whole plan (₹95k of ₹1.1M) | prompt scope-discipline rules; floor protection opt-in; deep clean stays |
| G7 | Door painted one face (21 sq ft vs 62–80) | `sides` multiplier (doors = 2) |
| G8 | Fresh-paint rate used on a repaint job | prompt + `tierHints`: existing walls → Repaint (PT07/08/09) |
| G9 | Dresser: no add-ons (extra drawer, LED profile); LED-backlit vanity mirror instead of aluminium-profile mirror | prompt rules: add-ons from brief; plain/full-length mirror → WP14 |
| G10 | Counts under-read ("two lounge chairs + side table", "six points", lights) | prompt: derive counts from the text; coverage check lists requirements with 0 lines |
| G11 | Partition priced as CNC jaali | prompt: partition panel → fluted HDHMR + PU unless "jaali" stated |
| G12 | No Scope Coverage sheet, no client-scope exclusions / disclaimers, no "Prepared by" | workbook: Scope Coverage sheet, exclusions + disclaimer block, prepared-by line |
| G13 | Min-charge: dismantling a unit billed 12 sq ft × 70 = ₹840 vs ₹2,500 L.S. | `MIN_AMOUNT` floor per rate id (CV22 → 2,500) |

Known residual differences (not fixable from data): project-specific rates the professional typed over the card (EL02 1,246 vs card 1,797; dresser custom 1,850/sq ft), site-measured quantities, lump-sum "wall repair" ₹10,000.

## 2. Tasks (vertical slices, each ends green)

1. `lib/rates/sheets.ts` + allowances in catalog — tests: resolve per sheet, fallback, GST strip.
2. `build.ts`: sheet-aware `push`, `title`, `rateSource`, `provisional`, `altRate`, `MIN_AMOUNT`, Livspace modular.
3. `lists.ts`: `Entrance`.
4. `brief.ts`: `title`, `sides`, companions, net-paint, deep clean, `sheet` option.
5. AI prompts (Anthropic + Manus): scope discipline + gap rules; allowance ids in card text.
6. `brief-response.ts`: `coverage`; routes accept `sheet`.
7. `xlsx.ts`: Scope Coverage sheet, exclusions, header sheet name, compare column.
8. UI: sheet selector, source/provisional badges, pass `sheet` everywhere.
9. Regression: Apex brief → `quantify()` ≈ expected BOQ (structure + qty exact; total within band).
10. Review → edge-case tests → lint/tsc/build → GitHub → Hostinger.
