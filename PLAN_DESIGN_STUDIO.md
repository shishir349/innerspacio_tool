# Design Studio: making it part of the designer's daily work

Goal: a designer opens Design Studio **first** when starting a room, and leaves with a client-ready concept and a BOQ draft. Today it is a one-way trip (photo → analysis → image). It needs to be a loop (idea → client reaction → revision → price).

## Where it stands (2026-10-22)

Photo upload (main + ≤2 angles) → Claude analysis (observed / inferred / uncertain, brief, draft work items, **Elevate this room**) → design brief form → concept images → per-room estimate → client link. Projects now group rooms.

What breaks the habit today:

| Gap | Why a designer drops the tool |
|---|---|
| Output is read-only | Suggestions can't be kept, rejected or turned into scope. |
| Concepts are one-shot | Real work is "keep this, change that"; there is no refinement. |
| Design and BOQ are separate | The same room is re-typed into the BOQ builder. |
| Rooms are isolated | A home needs one coherent style; each room starts from zero. |
| Client feedback lives in WhatsApp | The tool never learns what the client liked. |
| Desktop-first | The photo is taken on site, on a phone. |

## Plan, in order of payoff

Each step ships on its own. Order is by value to the designer ÷ effort. No step touches pricing logic.

### Step 1: Keep what's useful (small, 1 week)
- Per-idea actions on **Elevate this room** and suggested changes: *Keep*, *Skip*, *Edit text*. Stored with the analysis (`designerNotes` already exists; add a `picks` array).
- Only kept ideas flow into the brief and the concept prompt.
- Thumbs up/down on every AI idea. Stored. Tells us which prompts are weak.
- **Done when:** a designer can go from analysis to a brief containing only ideas they picked, in under a minute.

### Step 2: Idea → BOQ (medium, 1–2 weeks) — the habit-forming step
- "Add to BOQ" on a kept idea creates a scope item in the project's BOQ (`area` already carries the trade). It enters as `UNCONFIRMED`, so the existing Scope review gate applies and nothing is priced from a guess.
- The room's BOQ card shows "3 ideas waiting for sizes".
- Reuses: `BriefItem`, `ScopeReview`, `/api/boq/quantify`, projects → BOQs list.
- **Done when:** kept ideas appear in Scope review in the project's BOQ with the right room and trade.

### Step 3: Refine, don't regenerate (medium, 2 weeks)
- Chat-style change on a concept: "warmer wood", "remove the sofa", "lighter ceiling". Send the chosen concept as the base image plus the instruction.
- Lock layout (default on): geometry stays, finishes change.
- Variants side by side; star one; version history per room.
- **Done when:** three successive tweaks keep the room's layout recognisable.

### Step 4: Real materials in the prompt (medium, 1 week)
- A finish picker backed by the rate card (laminate codes, `ps:*` paints, stone). The chosen item goes into the concept prompt by name and into the BOQ by id.
- Concept and quote then describe the same thing.
- **Done when:** a concept's "key changes" list shows rate-card names, and each is one click from a BOQ line.

### Step 5: One style across the home (small–medium, 1 week)
- Project-level style: palette, materials, mood words, set once and offered to every room.
- "Apply to all rooms" for analysis settings; "make this room match the living room" for concepts.
- **Done when:** a new room's brief is pre-filled from the project style.

### Step 6: Client loop (medium, 2 weeks)
- On the client link: react per concept (love / maybe / no) and leave a note. Designer sees reactions on the room page and an activity feed on the project.
- "Approved" already exists; add "changes requested" that reopens refinement with the client's note attached.
- Never exposes costs or margins (existing DTO boundary and tests apply).
- **Done when:** a client reaction shows up on the designer's room without WhatsApp.

### Step 7: On-site, phone-first (medium, 2 weeks)
- Camera-first upload, a guided "shoot these 4 angles" prompt, queued uploads on a bad network.
- Pre-visit checklist generated from `uncertaintiesRequiringSiteVisit` + `questionsForClient`, tickable on site; answers feed back into the brief.
- **Done when:** a designer can capture a whole flat on a phone in one pass.

### Step 8: Speed and scale (ongoing)
- "Analyse all rooms" in one action, with background progress.
- Floor plan → room dimensions pre-filled (the plan reader already exists in the BOQ flow).
- Saved style presets and past-project references ("show me our last three Scandinavian living rooms").

### Step 9: Prove it works
- Track: time from first photo to first concept; share of ideas kept; concepts approved ÷ generated; BOQs started from a room.
- Review monthly with two or three designers; cut what isn't used.

## Principles
- Everything AI is a **suggestion with a verify-on-site flag**. The designer's edit always wins and is stored.
- No invented prices: ideas carry effort tiers, never rupees. Cost appears only after a quantity exists, through the BOQ.
- Reuse before building: BOQ scope gate, rate card, presentation DTOs, `getRepository()`.

## Decisions needed from you
1. Step order: BOQ link (2) before refinement (3), or the reverse?
2. Should client reactions (Step 6) be visible to the designer only, or also to the studio owner across projects?
3. Which 2–3 designers will trial each step?
