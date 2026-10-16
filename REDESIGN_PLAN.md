# InnerSpacio AI Studio — Full Redesign Plan

Status: **plan for approval — no code changed yet.**
Scope: every route (16 pages), every component (59 files), tokens, type, motion, layout, IA.

---

## 0. Brief (agreed)

| Decision | Answer |
|---|---|
| Surfaces & priority | All. **Client-facing first** (`/get-quote`, `/get-quote/result`, `/present/[token]`, `/login`); then the staff app. |
| Direction | **Architectural & editorial** — gallery-like, big confident type, generous space, material imagery, precise motion. |
| Brand authority | **innerspacio.com** for client-facing: its beige/brown world is the source of truth. The staff app inherits the same world, quieter. |
| Old look | Ivory + sage + Fraunces/Inter is discarded. It's evidence of what the brand isn't, not something to polish. |

**Modes (impeccable):** `/get-quote` = **Persuade**. `/present` + `/presentation` = **Experience** (the renders lead, the UI recedes). Dashboard, projects, design studio, BOQ, leads, catalogue and settings = **Operate** (scanability first, brand in the details). `/login` = Persuade-lite.

---

## 1. Evidence — what innerspacio.com actually is (measured with Chrome, 2026-10-16)

| Token | Value on innerspacio.com | Role |
|---|---|---|
| Canvas | `#F3EFE6` | page background (warm limestone) |
| Ink | `#211812` / deepest `#1A1008`, `#0F0907` | text, dark sections |
| Umber | `#6E5A49` | secondary text, links |
| Walnut | `#79553A` | primary CTA fill (pill buttons) |
| Sand | `#E8DDCC` | dividers, quiet surfaces |
| Paper | `#FFFDF8` | raised cards |
| Olive | `#626A44` | feature card (the "25+" stat card) |
| Saffron | `#FFD21F` (gradient `#FFF2A3 → #FECE22 → #E3A400`) | the single signal: active-nav dot, brush swoosh, step badges |
| Terracotta / rust | `#FF9A52 → #E8501A → #BF3606`, `#CF7448 → #7E3D25 → #4F200F` | testimonial / material gradient cards |
| Gold glow | radial `#FFFEF6 → #FFE7A6` | brand-reveal stage |

**Type:** display **CSVerdan** (high-contrast serif with a distinctive long-s / flourish "s", used for h1/h2 at 54–78 px, tracking −1 %); body **Moreus** (16 px, +0.32 px tracking); small labels in condensed caps (Moreus); also loaded: Avaleigh, Switzer, Colfax.
**Shape:** pills (`999px`) for every action, square/zero-radius editorial blocks, rounded media cards, floating objects with soft contact shadows.
**Motion:** Lenis smooth scroll; scroll-pinned sequences. These include a huge horizontal type marquee ("rooms hold … lives") with a card pinned over it, an exploding-furniture assembly, a logo reveal on a gold radial stage, a numbered process with a saffron brush stroke, and floating render tiles.
**Imagery:** sculptural bust made of rooms (hero), studio-shot furniture cut-outs, real project renders.

> Implementation consequence: client-facing pages must feel like they belong to innerspacio.com. A visitor arriving from the main site's "Estimate" link should not notice a handoff.

---

## 2. The new world: **"Atelier"** (one system, two volumes)

The same tokens and type everywhere. Only the **volume** changes:

- **Showroom volume** (client-facing): editorial scale, scroll choreography, imagery-led, Lenis on.
- **Studio volume** (staff app): the same palette and type at working sizes; motion is functional (feedback, continuity, focus); no scroll-jacking; dense data stays dense.

### 2.1 Color tokens (replace `app/globals.css` `:root` / `.dark`)

```
--canvas    #F3EFE6   --paper  #FFFDF8   --sand   #E8DDCC   --line  rgba(33,24,18,.10)
--ink       #211812   --ink-2  #6E5A49   --ink-3  rgba(33,24,18,.60)
--walnut    #79553A   (primary action)   --walnut-ink #F3EFE6
--olive     #626A44   (positive / "done" / feature)
--saffron   #FFD21F   (signal only: focus ring core, active dot, progress, highlights — never large fills in Studio)
--terracotta #E8501A  (warning / attention)   --rust #7E3D25 (destructive, replaces red)
--night     #0F0907 → #2E1A0D radial (dark stages: /present, brand moments)
```

- Every pair is checked to WCAG AA. Saffron is never used as text on canvas; Umber on canvas is verified ≥ 4.5:1.
- Dark mode becomes **"Night"**: walnut/umber on `--night`, used for `/present` and `/presentation` by default. It is offered in Studio as a setting.
- Charts get a 5-step earth ramp: walnut, olive, terracotta, umber, saffron.

### 2.2 Typography

| Role | Font | Notes |
|---|---|---|
| Display (h1–h2, hero numbers, room names in /present) | **CSVerdan** (the site's licensed face) → fallback **Instrument Serif** | Italic used for the emphasised word, as on the site ("to *extraordinary* spaces") |
| Text / UI | **Moreus** → fallback **Switzer** (free, Fontshare; the site's own fallback) | 15 px app / 16–17 px client, +0.02em |
| Labels / eyebrows / table headers | Moreus condensed caps, +0.08em | replaces the muted grey `text-xs` |
| Numbers (BOQ, ₹, quantities) | Switzer with `tabular-nums` | money and qty columns align |

- Fluid scale: client display `clamp(48px, 7vw, 112px)`; Studio h1 32 px, h2 22 px, body 15 px, table 13 px. The ratio is ~1.25 in Studio and ~1.5 in Showroom.
- `next/font/local` loads the brand files (woff2, subset Latin, `display: swap`, preload display + text only).
- **Open decision (blocking):** confirm the CSVerdan/Moreus web licence covers `tools.innerspacio.com` and send the woff2 files. Otherwise I ship the free fallbacks, which are nearly identical in rhythm.

### 2.3 Shape, space, depth

- **Actions:** pill (999 px) everywhere, like the site. Primary is walnut; secondary is an ink outline; tertiary is a text link with an underline that draws in.
- **Surfaces:** cards have 20 px radius on media and 12 px on data. No borders on the canvas; elevation is a warm contact shadow (`0 24px 48px -24px rgba(33,24,18,.25)`). Data panels use a 1 px `--line` hairline instead of shadow.
- **Grid:**
  - Showroom uses a 12-col grid with 24 px gutters and 96–160 px section spacing; asymmetric editorial layouts (text left 5 cols, image right 7) are the norm.
  - Studio uses an 8 px base, 16/24/32 rhythm and a 72 px header.
- **Signature details** (brand lives here in Studio):
  - the saffron "active" dot under the current nav item;
  - the roof-line glyph from the logo as section dividers and the loading mark;
  - condensed-caps eyebrows with a 24 px leading rule ("—— INTERIOR DESIGN").

### 2.4 Motion system (GSAP + Lenis)

One module, `lib/motion.ts` (extended), with named tokens:

| Token | Value | Use |
|---|---|---|
| `ease.out` | `power3.out` | entrances |
| `ease.inOut` | `expo.inOut` | page transitions, reveals |
| `ease.spring` | `back.out(1.4)` | pop-in badges, toasts |
| `dur.micro / ui / reveal / scene` | 0.15 / 0.3 / 0.8 / 1.4 s | — |
| `stagger.list / words` | 0.04 / 0.06 s | — |

Rules:
1. All GSAP inside `gsap.matchMedia()` with `MOTION_OK`. Reduced-motion gets instant states, no Lenis and no parallax (already a project rule; kept).
2. React integration via `useGSAP` with scoped refs and automatic cleanup. No raw `useEffect` tweens.
3. **Lenis on client-facing routes only** (`/get-quote`, result, `/present`, `/login`), synced to ScrollTrigger via `lenis.on('scroll', ScrollTrigger.update)` and `gsap.ticker`. Studio keeps native scroll, because nested scroll areas (BOQ table, dialogs) fight it. That is an existing rule, now made explicit.
4. Animate only `transform`/`opacity`/`clip-path`. Use `will-change` only during a tween. Large pinned scenes are capped at one per viewport.
5. Plugins: ScrollTrigger, **SplitText** (free since GSAP 3.13), **Flip** (layout continuity), Observer (drag/scrub on renders). Plugins are registered once in `lib/motion.ts`.

Motion catalogue (what gets built):

| Moment | Where | Technique |
|---|---|---|
| Headline type reveal (line-masked, italic word lands last) | all display headings | SplitText lines + `yPercent` mask |
| Horizontal giant-type marquee with pinned stat/estimate card | /get-quote intro | ScrollTrigger pin + scrub |
| Room-by-room wizard: rooms "assemble" like the furniture explosion | /get-quote steps | timeline per step, Flip between steps |
| AI image generation: render "develops" from blueprint to photo | quote + design studio | clip-path wipe + saturation tween, saffron progress line |
| Estimate total counts up per trade, bars grow | result page | CountUp (existing) + stagger |
| Brand reveal on gold radial stage | /present intro, /login | timeline, logo stroke draw (roof line) |
| Before/after slider with inertia | /present, design studio | Observer drag + `quickTo` |
| Page transitions (Studio): content fades/rises 12 px, nav dot slides | app shell | timeline on route change; Flip for the active dot |
| List/table row entrance (first paint only), row add/remove | projects, leads, BOQ | stagger; Flip on reorder |
| Micro: pill button arrow slide, underline draw, toast spring, focus ring | everywhere | CSS transitions plus GSAP where sequenced |

---

## 3. Page-by-page

### Showroom (client-facing) — highest craft
1. **`/get-quote` (Persuade).** Hero in the site's voice ("Tell us about your rooms."), the horizontal marquee scene, then the wizard as an editorial sequence:
   - Each step is a full-height chapter: rooms, photos, ideas, contact, tier.
   - The step badge is numbered in a saffron brush, matching the site's "Material selection 04".
   - Upload tiles render as floating render cards.
   - The tier choice uses three material cards in the olive, terracotta and gold gradients from the site.
   - Every guard is kept (honeypot, limits, consent).
2. **`/get-quote/result/[token]`.**
   - Before/after per room as large editorial spreads.
   - The estimate is a typographic range at display size, with the trade breakdown as a counted, animated ledger.
   - "Book a consultation" is a walnut pill.
   - The customer-safe boundary is untouched: trades, rooms and published rates only.
3. **`/present/[token]` + `/presentation/...` (Experience, Night).**
   - Gold-stage brand reveal, then one room per chapter: full-bleed render, room name in CSVerdan, design notes as captions.
   - Keyboard and swipe navigation; the before/after slider.
   - The UI recedes to a thin progress rail.
   - Only `lib/presentation/*` DTOs are rendered (rule kept).
4. **`/login` (Persuade-lite).** Split screen: a slowly drifting hero render on one side; a minimal form on the canvas with a pill submit and a roof-line loading mark.

### Studio (staff app) — Operate
5. **App shell.**
   - Top bar (72 px) replaces the sidebar feel: logo wordmark, condensed-caps nav (Dashboard · Projects · Design Studio · BOQ · Leads · Catalogue) with the saffron active dot, and a ⌘K command palette (new).
   - **Project context switcher**, since everything now hangs off a project: the current project shows in a persistent breadcrumb pill.
6. **Dashboard.** Three editorial numbers (active projects, BOQs this month, new leads), a "continue where you left off" strip (last 3 projects with render thumbnails), and the leads inbox preview.
7. **Projects list → project page as the hub.**
   - The list is cards with the hero render, client name, status chip and counts (rooms · BOQs · leads).
   - The project page is a tabbed hub (Overview · Design · BOQ · Lead · Presentation) connecting the tools wired last session.
8. **Design Studio room page.**
   - Three-column workbench: photos and brief on the left, the canvas (concepts, before/after) in the centre, analysis and estimate on the right.
   - Generation shows the blueprint-to-photo develop animation.
   - Concept selection uses Flip into the "selected" slot.
9. **BOQ builder (densest screen).**
   - A sticky summary bar: total, rate sheet, save state and export.
   - The table gets condensed-caps headers, tabular numbers, room-group rows with sticky subheaders and zebra in sand at 40 %.
   - The rate-source badge is a dot plus label; inline edit focus uses a saffron underline.
   - The plan-analysis panel becomes a stepped side-sheet with live consensus progress ("3 analyses · 2 done").
   - **No decorative motion in the table.**
10. **Leads.** An inbox layout with a list on the left and detail on the right: rooms, ideas, generated images and estimate. "Open project / Open BOQ" are pills.
11. **Cost catalogue, Settings.** Clean forms on paper cards, grouped settings and inline validation.

### Shared components (rebuilt on Base UI/shadcn primitives, restyled — not replaced)
Button (pill variants), Input/Textarea/Select (underline-on-canvas and boxed-on-paper variants), Badge → **Chip**, Card → **Surface** (media / data / feature [olive/terracotta/gold]), Dialog/AlertDialog (sheet from right in Studio, centred on Showroom), Tabs (underline that slides), Table (density modes), Toast (sonner restyled), Skeleton → shimmer in sand, Empty states (roof-line glyph plus one-line CTA), Progress (saffron line), **new**: CommandPalette, ProjectSwitcher, BeforeAfter, RenderCard, StepBadge, Eyebrow, Marquee, StatNumber.

---

## 4. Phased delivery (incremental; each phase ships green)

| Phase | Deliverable | Skills used |
|---|---|---|
| **P0 Context** | `PRODUCT.md` (impeccable init), `DESIGN.md` documenting Atelier (tokens, type, motion, components), brand kit page (logo usage, palette, type specimen) | `/impeccable` (init, document, shape — done for this plan), `/brandkit`, `/agent-skills:spec` |
| **P1 Foundations** | New tokens in `globals.css`, fonts via `next/font/local`, `lib/motion.ts` v2 (tokens, plugin registration, Lenis↔ScrollTrigger bridge), restyled primitives in `components/ui`, new shared components | `/impeccable typeset`, `/design-taste-frontend-v1`, `/high-end-visual-design`, `/ui-ux-pro-max`, `/gsap-core`, `/gsap-utils`, `/gsap-frameworks`, `/gsap-react` |
| **P2 Showroom** | `/get-quote`, result, `/present`, `/presentation`, `/login` | `/impeccable craft`, `/impeccable animate`, `/impeccable delight`, `/stitch-design-taste`, `/apple-design`, `/gsap-timeline`, `/gsap-scrolltrigger`, `/find-animation-opportunities` |
| **P3 Studio shell + hubs** | App shell, command palette, project switcher, dashboard, projects list, project hub | `/impeccable craft`, `/ui-ux-pro-max`, `/apple-design`, `/gsap-react` |
| **P4 Studio tools** | Design Studio room workbench, BOQ builder, leads inbox, catalogue, settings | `/impeccable craft`, `/impeccable typeset`, `/impeccable adapt` |
| **P5 Motion pass** | Audit every animation against the catalogue: timing, reduced-motion, 60 fps | `/improve-animations`, `/gsap-performance`, `/impeccable animate` |
| **P6 Adapt + review** | Mobile/tablet for every route (Showroom is mobile-first, since clients open quotes on phones), a11y, critique and fix round | `/impeccable adapt`, `/impeccable critique`, `/agent-skills:review`, `/agent-skills:test` |
| **P7 Ship** | Build, deploy to Hostinger, smoke test | `/agent-skills:build`, `/agent-skills:incremental-implementation` (applied every phase) |

`/ponytail` governs every phase: restyle the existing primitives instead of adding a UI library, keep one motion module, and add no new dependency beyond the fonts (GSAP, @gsap/react and Lenis are already installed).

---

## 5. Verification (each phase)

- `npx tsc --noEmit`, `npm run lint`, `npm run test` stay green. Existing tests pin behaviour, not looks.
- Impeccable detector (`detect.mjs`) on changed files, run once per phase.
- One batched visual check per phase with Chrome, desktop and mobile together: screenshots of every changed route. Fix in one batch, confirm once.
- Motion: reduced-motion emulation shows no animation and no Lenis. A performance trace on `/get-quote` holds 60 fps on mid-range Android emulation. No layout shift from fonts (`size-adjust` fallbacks).
- Budgets: client JS on `/get-quote` up by ≤ 40 KB gz (GSAP plugins + SplitText); LCP ≤ 2.5 s; AA contrast on every token pair.
- Invariants untouched: client-safe DTO boundary, auth layering, public-flow guards, BOQ math (all covered by existing tests).

## 6. Risks & open decisions

1. **Font licence (blocking for P1):** CSVerdan/Moreus files and licence for the tools subdomain. If they aren't available, I use the free fallbacks.
2. **Imagery:** may I reuse the site's hero bust, furniture cut-outs and project renders on client-facing pages? Without them, the Showroom uses the client's own renders and generated concepts only.
3. **Dark "Night" for /present by default:** confirm. The site itself is light, with dark stages only for moments.
4. **BOQ density:** the designers' muscle memory matters. I keep column order and keyboard behaviour and change only styling.
5. Scroll-jacking is limited to the Showroom; Studio never hijacks scroll.

## 7. Acceptance

- A visitor clicking "Estimate" on innerspacio.com lands on `/get-quote` and reads it as the same site: same canvas, type, pills and motion character.
- Each Studio screen keeps or improves task speed: no extra clicks for save/export/generate, and every action is reachable by keyboard.
- No animation without a job; reduced-motion users get a complete, static experience.
- All existing tests pass; no new runtime dependency besides font files.
