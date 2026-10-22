# Not asked yet

The system uses the **assumption** shown for each. Ask later if a number or scope matters.
Format is WhatsApp-ready (`*bold*`).

*A. Rates & prices*

*A1. GST*
All rates (card, paint, project) are ex-GST, 18% on top? ✅/❌
_System assumes:_ ex-GST. Paint sheet is read as ex-GST (Amount = Area × Rate, GST in its own column). Flip is one constant.

*A2. Other cities*
Rates are NCR. Add % for Mumbai, Bengaluru, Pune, Hyderabad…?
_System assumes:_ same rate for every city, plus a warning for non-NCR (`CITY_RATE_FACTORS` is empty).

*A3. Project rates still valid?*
Taken from 2 old jobs (Apex, Greenwoods): wardrobe ₹2,491/sqft, TV ₹1,869, study ₹2,180, utility ₹2,180, kids study ₹2,336, nook ₹2,725, crockery ₹2,803, quartz ₹1,246, vanity ₹46,714 (master ₹54,500), vanity mirror ₹1,100 (master ₹1,600), shower ₹1,168, feature wall ₹1,012, French moulding ₹389, wainscot ₹467/rft, foyer panel ₹779, PVC ceiling ₹311, bookshelf ₹1,168/rft.
_System assumes:_ still valid; modular ones scale by tier.

*A4. Package price bands*
Package range (3BHK Premium ₹15–28L) vs ₹/sqft baseline (₹1,500–3,200) clash. Which is final?
_System assumes:_ the package bands set the price (quote is fitted to them). ₹/sqft only gives warnings.

*A5. Quote range*
Quote shows total −8% to +12%. OK?
_System assumes:_ yes (0.92 / 1.12).

*A6. Luxury label*
Luxury = "budget above ₹50L", but 3BHK Luxury quote is ₹28–42L. Relabel or reprice?
_System assumes:_ leave tier copy and bands as they are.

*A7. Loose furniture and décor rates*
Loose furniture (Basic / Elevated / Luxury) and décor allowance (Basic ₹1.56L, Premium ₹3.9L, Luxury ₹7.8L) current and verified? Keep décor as a default in Premium and Luxury?
_System assumes:_ yes, décor added by default in Premium and Luxury quotes.

*A8. Minimum charges*
Only dismantling has a minimum (₹2,500). Any other?
_System assumes:_ no other minimums.

*A9. Margin and cost*
Want a material / labour / hardware split and margin %?
_System assumes:_ no. Selling rates only; the internal cost layer stays empty.

*B. Scope: what is OURS in the package*

*B1. Mark each ours or client's*
flooring · wall and floor tiles (supply) · lights / fans / geyser · curtains · sofa / beds / dining set / desk · false ceiling in every room · demolition and masonry · glass shower partition in every bathroom
_Terms sheet says flooring, tiles, lights and civil are client scope. The system prices most of them._
_System assumes:_ all of the above are ours and priced (flooring only in Premium and Luxury; false ceiling in every dry room at every tier: plain / designer / stepped; one shower partition per bathroom). Already decided: sanitaryware and fixtures are client scope.

*B2. Overheads*
Design, 2D/3D, PM, supervision, transport, lift or society charges, scaffolding, POP punning, contingency: in rates or extra? Any %?
_System assumes:_ included in rates, no separate line. Scaffolding, POP punning and 3+ colours per wall are listed as "extra" in the paint descriptions but not priced.

*B3. Doors, windows, grills*
Never added by default. Door polish or paint with a repaint?
_System assumes:_ only when a requirement names them.

*B4. Floor protection*
₹36/sqft on carpet area or whole area including balconies? Heavy-duty ₹55 for marble / wood: when?
_System assumes:_ standard ₹36 on the plan's floor area (spec mode: carpet area). Heavy-duty is never added automatically.

*C. Sizes & quantities*

*C1. Rooms per BHK*
3BHK = 1 living, 1 dining, 1 kitchen, 3 bed, 3 bath. Add balcony, utility, foyer, pooja, study?
_System assumes:_ only living, dining, kitchen, bedroom, bathroom plus up to 2 "other" (foyer, balcony).

*C2. Flat BOQs*
Plan-mode default sizes (wardrobe = 31% of room area, TV 9×8, kitchen run, quartz) were fitted on only 2 villas. Share 3–5 *flat* BOQs + plans so we can refit?
_System assumes:_ current sizes, flagged "assumed" in the BOQ.

*C3. Quantity rules*
Tile / stone wastage (7–12%) and 15% deduction for doors and windows: added to quantity, or already in the rate?
_System assumes:_ 15% deducted on walls (paint, tile), wastage not added.

*C4. Plans without dimensions*
Assume sizes (flagged) or stop and ask?
_System assumes:_ assume and flag as "assumed".

*C5. Loft in wardrobes*
Premium and Luxury get a wardrobe loft (2.5 ft). Standard, or on request?
_System assumes:_ included in Premium and Luxury spec-mode.

*D. Tiers, terms, access*

*D1. Modular rates by tier*
Plan mode: should modular rates scale by tier (Essential cheaper, Luxury dearer)? Finish per tier (shutter, carcass, hardware, countertop, flooring)?
_System assumes:_ yes. Essential = laminate + Prelam, Premium = HDHMR, Luxury = BWP + acrylic; countertop granite / quartz / premium quartz.

*D2. Customer view*
Show room-wise rates to customers in the quote?
_System assumes:_ yes, trades, rooms and published rates only (no cost or margin).

*D3. Terms and conditions*
Send final text: estimate validity, payment milestones, warranty years.
_System assumes:_ generic text only. Client-scope list and disclaimers come from the professional's sample BOQ.

*D4. Access*
Everyone signed in sees *all* projects and BOQs. Restrict to owner only? Public sign-up off in Supabase?
_System assumes:_ shared access. Technical risk: any signed-in user can read and write every BOQ.

*D5. Approval*
Who approves a BOQ before export (roles)?
_System assumes:_ any signed-in user can approve the scope and the BOQ.
