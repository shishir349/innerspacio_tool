# Design system: Atelier

One system, two volumes. **Showroom** (client-facing): editorial scale, scroll choreography, Lenis. **Studio** (staff): the same palette and type at working sizes; motion only for feedback and continuity; native scroll.

Source of truth for the look: innerspacio.com, measured in Chrome (2026-10-16).

## Color (tokens in `app/globals.css`)
| Token | Hex | Role |
|---|---|---|
| canvas / `--background` | `#F3EFE6` | page |
| paper / `--card` | `#FFFDF8` | raised surfaces, inputs |
| ink / `--foreground` | `#211812` | text |
| umber / `--muted-foreground` | `#6E5A49` | secondary text (AA on canvas) |
| sand / `--secondary` | `#E8DDCC` | quiet fills, chips |
| walnut / `--primary` | `#79553A` | the primary action pill |
| olive | `#626A44` | feature surface, positive |
| terracotta / rust | `#E8501A` / `#7E3D25` | attention / destructive |
| saffron | `#FFD21F` | the ONE signal: active-nav dot, progress, selection, focus accent. Never text on canvas, never large fills in Studio |
| night | `#0F0907` | dark stage (`.dark`): the presentation, brand moments |

Gradients (`.surface-olive/-terracotta/-gold/-night`, `.stage-gold`) are copied from the site's cards and stages.

## Type
- **Display: CSVerdan** (`.display`, `.editorial-heading`): headlines, room names, big numbers; `<em>` is the italic accent word. Sizes `.display-xl/-lg/-md` (fluid).
- **Text: Instrument Sans**: paragraphs, inputs, tables. (Moreus, the site's caption face, is caps-only: not used for reading text.)
- **Labels: Moho Condensed** (`.font-caps`, `.eyebrow`, `.label-caps`, `.num`): nav, buttons, chips, table headers, numerals. Always caps with tracking.
- The rupee sign falls back to the system font per glyph (none of the brand faces carry it).
- Licence note: the supplied brand fonts are marked "Demo for Personal Use": confirm a commercial licence for web embedding on `tools.innerspacio.com`.

## Shape and space
Pills for every action (`rounded-full`); 16–24px radii on cards, 12px on data; hairline `--border` instead of shadows in Studio; warm contact shadow (`.contact-shadow`) on showroom media. 8px base; showroom sections 96–160px apart; Studio top bar 72px.

## Motion (`lib/motion.ts`)
Tokens: `EASE` (`out`, `expo`, `inOut`, `spring`), `DUR` (micro .15 / ui .3 / reveal .8 / scene 1.4), `STAGGER`. Plugins registered once: ScrollTrigger, SplitText, Flip, Observer, `useGSAP`.
Rules: everything inside `gsap.matchMedia()` under `MOTION_OK` (pinned scenes also under `DESKTOP`); transform/opacity/clip-path only; Lenis on client-facing routes only (`components/motion/smooth-scroll.tsx`, `scrollToId`).
Components: `Reveal`, `CountUp`, `Pop`, `PageFade`, `Develop` (render wipes in from a desaturated proof), `BrandReveal` (roof line draws on the gold stage, once per session).

## Components
Restyled primitives in `components/ui` (Button pill + arrow nudge, Chip/Badge caps, Card paper, Input/Textarea/Select boxed with saffron focus accent, Tabs pill, Table caps headers, Dialog rounded sheet, Progress saffron line, Skeleton sand). Shell: top bar + saffron nav dot (`nav-links.tsx`), ⌘K palette (`command-palette.tsx`), mobile full-height menu. Logo: roof line + wide-tracked caps (`logo.tsx`).

## Dev harness
`/dev/showroom` and `/dev/showroom?v=result` render the client-facing views with sample data (404 in production).
