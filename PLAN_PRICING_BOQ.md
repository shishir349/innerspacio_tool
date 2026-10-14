# Plan: Justified pricing + go-to-go BOQ

## What the inputs told us

**Spazay rate list** (`pricing/CX_Spazay…pdf`, 23 pp, ~400 items) — client-facing *selling* rates, coded
(`C01`, `S04`, `FC02`, `PT03`, `ST08`, `BTH01`, `LFE01`…), per-unit, with "copy-ready BOQ line item
descriptions". Modular is built up: carcass + shutter + hardware, each ₹/sq ft of cabinet elevation.
Loose furniture and décor allowance come in 3 grades (Basic / Elevated / Luxury) = our 3 tiers.

**Livspace NCR MRC** (`pricing/Livspace…pdf`, 128 pp, 3,099 rows) — 95% modular carpentry. Model is
*standard price per sq ft* (₹2,040–3,675 inc. GST) + *upgrade deltas* (HDHMR core +₹255/sq ft, HGL shutter
+₹835…) + *add-ons* per unit. Civil/electrical/painting/plumbing are small flat lists. Used here as the
**market benchmark** that our Spazay-built numbers must stay near.

**Reference BOQ** (`reference_BOQ/*.png`) — 6-sheet workbook: Instructions · **Master BOQ**
(Room | Trade | Line item | Description | UOM | L | B | H | Qty | Rate | Amount = Qty × Rate; rooms as
sections; dropdowns from Lists) · **Trade Summary** (SUMIF by trade, 19 trades + Market Supply) ·
**Room Summary** (SUMIF by room) · **Lists** (trade/room/standard item/UOM) · **General Assumptions**
(brand/spec per category + wastage + GST notes). Rate-neutral: rate typed per project.

## Key idea: one engine, two outputs

```
home spec (BHK, size, city, rooms, tier)
        │
        ▼
 scope templates  ──►  BOQ lines  ──►  Σ = estimate  (public quote, justified)
 (room × tier)         (qty × Spazay rate)        └─►  editable BOQ + .xlsx (designers)
```

The estimate is no longer a made-up score inside a band. It is the sum of BOQ lines, so every rupee in
the customer's range can be traced to a line, a quantity and a published rate.

## Decisions (change if wrong)

| # | Decision | Why |
|---|---|---|
| 1 | Rates = Spazay selling rates, Livspace = cross-check only | Spazay is item-level + client-facing; Livspace is modular-only |
| 2 | Tiers become *specifications*: Essential = prelam particle + SF laminate + EBCO; Premium = HDHMR + Royal Touch + Hettich; Luxury = BWP + acrylic + Hettich + stone/marble | Matches both sheets' grading; tier prices then follow from materials, not from a band |
| 3 | Bands (15–20 / 20–55 / 55–90L) are **no longer clamps**; they become calibration tests | Clamping a bottom-up number destroys the justification |
| 4 | Range = total × 0.92 … × 1.12, rounded to ₹0.5L | Site condition + final selection variance |
| 5 | Rooms with no measured size use standard dimensions per room type, scaled by BHK/size | Quote has no measurements; assumptions are printed to customer |
| 6 | GST not added (Spazay says confirm per client terms) — shown as "+ GST as applicable" | Avoids double-charging; open question for you |
| 7 | BOQ lives at `/boq` (staff-only), no new table; export-first | No migration needed; add persistence later if designers must resume |

## Tasks (vertical slices, TDD)

| # | Task | Acceptance |
|---|---|---|
| 1 | `lib/rates`: generated Spazay catalog + Livspace benchmark table | unique ids, rate > 0, units normalized; test |
| 2 | `lib/boq`: scope templates + `buildBoq()` | amount = qty×rate; tier E<P<L; more rooms ⇒ more ₹; typical 3 BHK mid lands in each band; modular within ±30% of Livspace |
| 3 | Swap `lib/quote/estimate.ts` onto BOQ; keep public API; add breakdown to result | old callers compile; quote result carries per-trade + per-room + assumptions |
| 4 | Result page "How we got here" | trade bars, room totals, assumptions, no cost/margin fields |
| 5 | `lib/boq/xlsx.ts`: workbook like reference (formulas + dropdowns) | reload: 6 sheets, K = I*J formulas, SUMIF summaries, validations |
| 6 | `POST /api/boq/build`, `POST /api/boq/export` (auth, zod, caps) | 401 w/o user; ≤400 lines; amount recomputed server-side |
| 7 | `/boq` page + editor; `/leads` list → "Open BOQ" prefill | build → edit qty/rate/room → download .xlsx |
| 8 | Docs, CLAUDE.md, full gates, deploy | tsc, eslint, vitest, `next build --webpack` |

Checkpoints after 2 (engine numbers sane), 5 (xlsx opens), 7 (UI end-to-end).

## Risks / open questions

- **Quantity assumptions are mine** (room dims, wardrobe widths, point counts). They are plain tables in
  `lib/boq/spec.ts` — your estimators should overwrite them. Tests pin the *bands*, not the numbers.
- **Spazay rates likely NCR-priced**; city factor is a placeholder (NCR 1.00, other metro 1.03, rest 0.95).
- Livspace includes 18% GST; Spazay unclear. Benchmark test uses ±30% to absorb that.
- No pie charts in xlsx (exceljs has no chart API); numbers are all there.
