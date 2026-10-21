# Design system: Blueprint

Cream drafting paper, royal-blue ink. One system, two volumes. **Showroom** (client-facing): poster-scale Paceon, scroll choreography, Lenis. **Studio** (staff): the same palette and type at working sizes; motion is feedback and continuity, scroll is still Lenis but inner scroll areas (tables, dialogs, selects) stay native.

The world is the architect's sheet: measured hairlines with end ticks (dimension lines), plan linework that draws itself, full-bleed royal bands that invert to cream. It replaces the earlier "Atelier" look (walnut, saffron, serif).

## Color (tokens in `app/globals.css`)
| Token | Hex | Role |
|---|---|---|
| cream / `--background` | `#F8F3F0` | page |
| paper / `--card` | `#FFFCFA` | raised surfaces, inputs |
| royal / `--primary` | `#014BAA` | action, accent word, ink lines, active state |
| royal-deep | `#01367A` | hover / pressed |
| ink / `--foreground` | `#0A1D42` | text |
| ink-soft / `--muted-foreground` | `#46587A` | secondary text (AA on cream) |
| mist / `--secondary` | `#ECE5E0` | quiet fills |
| `--accent` | `#E4ECF8` | selected / hover tint (a tint of royal) |
| signal | `#8DB8F4` | only on navy and royal: accent word, focus, selection |
| navy / `.dark` | `#051836` | dark stage: client presentation, brand moments |
| danger / success | `#B3261E` / `#1C7A54` | functional only |

Borders and inputs are royal at 15% / 25% alpha (`--border`, `--input`), so lines read as blue ink on cream. Only royal, cream and tints of them are brand colors; danger and success exist so errors and confirmations stay legible.

## Type
- **Paceon** (`.display`, h1-h4, `font-heading`, `font-wordmark`): ultra-condensed caps, one weight. Poster headings and marquee only, **never below ~28px** (the N loses its diagonal), never for prose, buttons or money: it has no rupee sign, dashes, bullets or arrows. Sizes `.display-xl/-lg/-md` (max 6rem). `<em>` inside a display is the royal accent word (signal on dark), not italic.
- **Archivo** (variable, default weight 500; `font-sans`, `font-caps`, `.num`): everything read or measured: paragraphs, inputs, tables, buttons (caps, 600, tracked), tabs, badges, `.label-caps`, rupee amounts and tabular numerals.
- Large money in a Paceon hero draws the rupee sign in Archivo (`Rupee` in `estimate-view.tsx`) and the range dash as a CSS bar.
- Fonts are declared in `globals.css` (`@font-face`, files in `app/fonts`). Licence: Paceon ships as PERSONAL USE ONLY ("README!.txt"): buy the commercial licence before relying on it in production.

## Shape and space
Buttons, chips, tabs and inputs are 6-8px radius rectangles; cards 12-16px; hairline `--border` instead of shadow in Studio; warm contact shadow on showroom media. 8px base; showroom sections 96-160px apart; Studio top bar 72px. No eyebrow above a heading: `PageHeader` carries title, optional breadcrumb `meta`, description and actions, then a drawn dimension line.

## Motion (`lib/motion.ts`, `components/motion/*`)
GSAP + ScrollTrigger + SplitText + DrawSVG, one registration point. Everything runs in `gsap.matchMedia()` under `MOTION_OK` (pinned or parallax scenes also under `DESKTOP`, magnetic under `FINE_POINTER`); server HTML is always the finished page.
Tokens `EASE`, `DUR`, `STAGGER`. Components: `SplitHeading` (masked line rise, plays on load or on scroll), `ScrollReveal` (rise / wipe / fade / scale, optional child stagger), `Parallax` (scrubbed image drift), `DrawLine` (dimension line), `Marquee` (Paceon ticker whose speed follows scroll velocity), `Magnetic` (CTA pull), `ScrollProgress` (royal hairline), `CountUp`, `Pop`, `Develop`, `BrandReveal`, `Reveal` (CSS stagger).
**Lenis** (`smooth-scroll.tsx`) mounts once in the root layout, driven by the GSAP ticker; `prevent` keeps dialogs, menus, selects, textareas and `.overflow-*` containers native; `/boq-print` scrolls natively; reduced-motion users get none. `scrollToId()` and `getLenis()` for programmatic scroll.

## Components
Primitives in `components/ui` restyled to the tokens (Button rectangle with arrow nudge, Badge/Tabs Archivo caps, Card paper, Input boxed). Shell: top bar + royal nav dot (`nav-links.tsx`), ⌘K palette, mobile menu. Logo: `LogoMark` paints `public/logo.webp` through a CSS mask (royal on cream, cream on navy).

## Dev harness
`/dev/showroom` and `/dev/showroom?v=result` render the client-facing views with sample data (404 in production).
