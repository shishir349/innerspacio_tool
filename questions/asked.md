# Asked to the designer (waiting for answers)

Round 1 was answered on 2026-10-22 (see [answered.md](answered.md), Round 2). Two things from that round still block pricing.

*BOQ – 2 follow-ups*

*1. Cost prices → selling prices*
You gave these *without margin*: InnoTech drawer set ₹7,000, wicker basket ₹5,000, GTPT fitting ₹5,000–6,000.
The card sells an InnoTech drawer at ₹9,343, which is about 25% margin on ₹7,000.
Should we sell the wicker basket and GTPT at the same 25% margin (≈ ₹6,667 and ≈ ₹7,333 at ₹5,500) and show them as provisional lines?

*2. Upholstery*
₹600–800 per metre is a range. Which one goes in the estimate: ₹600, ₹700 or ₹800? And roughly how many metres for a bed and for a 3-seater sofa?

## What the system does today (until answered)

| Q | Current behaviour | Where |
|---|---|---|
| 1 | Grain trolley, wicker basket, GTPT are stated in the estimate, **not priced**. The drawer set is billed at the card's ₹9,343 per piece. | `KITCHEN_UNPRICED` in `lib/boq/standards.ts`, `mod:K03` |
| 2 | Upholstery refresh is held with no rate. | `lib/boq/brief.ts` |
