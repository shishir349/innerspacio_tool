# Answered (built into the system)

From the designer, 2026-10-21. Code rules: `lib/boq/standards.ts`, `lib/boq/tier-guard.ts`, `lib/boq/brief.ts`, `lib/boq/build.ts`. Commit `9f6f25b`.

| # | Question | Answer | In the system |
|---|---|---|---|
| 1 | Kitchen pricing basis | Pre-booking: standard spec (HG laminate, HDHMR, Hettich, 5–6 InnoTech drawers, rest shutters). Post-booking: redesigned to the client's choices. | Spec-mode standard kitchen; plan mode uses `pr:KITCHENHG` ₹1,750 since 2026-10-22 (see Round 2). |
| 2 | Paint rates | Paint rate sheet shared. | `lib/rates/paint-rates.csv` → `ps:*` ids, go-to paint price. |
| 3 | Bathroom scope | Vanity is a separate modular line. Fixtures and sanitaryware are client scope. | Vanity priced; sanitaryware held EXCLUDED. |
| 4 | Bathroom tile height | 8 ft, validated after booking. | `BATH_TILE_H = 8` (spec and plan mode). |
| 5 | Kitchen inclusions | Laminate; HDHMR + BWP at the wet area; grain trolley; 1 wicker basket; 5–6 InnoTech drawers; shutter units; GTPT unit; bottle pull-out; loft optional. | Priced: laminate, HDHMR, BWP sink base, 6 drawers, bottle pull-out. Not priced (no rate): grain trolley, wicker basket, GTPT. No loft. |
| 6 | Tier meaning | Essential = low budget, limited designs, basic. Premium = good budget, wider range, durable. Luxury = high end, budget above ₹50L. | Existing tier copy matches; the ₹50L figure is not coded (see not-asked A6). |
| 7 | Default charges | Only when specifically required. Disclaimer. Floor protection included by default. | Floor protection default; deep cleaning, electrical, waterproofing opt-in; disclaimer in assumptions. |
| 8 | Measurement units | Sq.Ft.: surface work. Rft: skirting, profiles, grooves, pelmets, coves. Nos: furniture, lights, fans, hardware. L.S.: minor civil, plumbing or electrical changes, misc. | Card unit is the rule; `validateBoq` warns on a different unit. Prompt carries the rule. |

## Round 2 — "BOQ – 4 quick questions" (answered 2026-10-22)

All prices are the designer's assumptions: they vary with design, fabric quality and brand, but are fine for an initial quote.

| # | Question | Answer | In the system |
|---|---|---|---|
| 1a | Kitchen ₹/sqft, HG laminate | ₹1,750 | `pr:KITCHENHG` (PR25). Plan-mode class `kitchen_cabinetry` uses it; `kitchen_acrylic` keeps `pr:KITCHEN` ₹3,348 for acrylic only. |
| 1b | Grain trolley | Included in the per-sqft rate. Drawer is extra: ₹7,000 per InnoTech drawer set, **without margin**. | Not priced yet: no margin policy (see asked.md Q1). |
| 1c | Wicker basket | ₹5,000 without margin. | Not priced yet (asked.md Q1). |
| 1d | GTPT unit | ₹5,000–6,000, fitting only (box is added to the sqft area), without margin. | Not priced yet (asked.md Q1). |
| 1e | Bed / sofa upholstery refresh | ₹600–800 per metre, standard to mid-range fabric. Stitching, labour, foam and repairs separate. | Not priced yet: a range, not a rate (asked.md Q2). |
| 1f | InnoTech drawer ₹9,343 / bottle pull-out ₹7,007: piece or set? | Per piece. | Already billed per piece. |
| 1g | Guesses: curtains ₹800/rft, nameplate ₹6,000, L-sofa ₹2.28L, railing ₹2,491/rft, jacuzzi ₹60,000 | OK as initial-quote assumptions. | Unchanged; still flagged provisional. |
| 2a | Electrical | Priced per point by design (8-module board ≈ ₹2,500; more modules, higher). Use the Livspace list. Stays on request. | No default allowance. Per-point rates come from the Livspace map. |
| 2b | Vague items (civil, balcony furnishing, patchwork) | Optional: keep the "confirm it" option. | Unchanged (UNCONFIRMED, never priced). |
| 3 | Standard sizes | Confirmed: carpet 1BHK 450–600, 2BHK 750–1,000, 3BHK 1,050–1,300 / 1,400–1,600, 4BHK 1,600–2,000 / 2,100–2,400, 5BHK+ 2,500–3,000+; living 12×14–14×16, dining 8×10–10×11, kitchen 8×9–9×11, bedroom 10×11–12×14, bath 5×7–5×8, ceiling 9–10 ft; master wardrobe 8×7, others 6×7, crockery 5×7, dresser 4×3, TV unit as per wall. | `lib/boq/standards.ts` already uses the upper end of each range. |
| 4a | Whole-home paint = 2.45 × floor area | Yes; the vendor validates on actual measurements. | Unchanged. |
| 4b | Renovation default | Repaint. | AI prompt already says existing walls = repaint. |
| 4c | Grades ₹28 / ₹48 / ₹76 | Yes. | `ps:F01` / `ps:F06` / `ps:F05`. |
