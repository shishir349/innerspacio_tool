# CLAUDE.md

InnerSpacio AI Studio — internal tool for interior designers to use in client meetings: photograph a room → AI room analysis → generate redesign concepts → build a preliminary estimate → present to client without exposing costs/margins. Full detail lives in `README.md` (long; has the security model and deploy checklist). Read `AGENTS.md` too.

## Stack

Next.js 16.4 (App Router, Turbopack), React 19, TypeScript strict, Tailwind v4 + shadcn (`base-nova`, Base UI), Supabase (`@supabase/ssr`), Anthropic SDK, Zod 4, Vitest 5. Path alias `@/*` → repo root.

**Next 16 differs from older Next.** `proxy.ts` replaces `middleware.ts`; `params` is a `Promise`. Before writing Next-specific code, read `node_modules/next/dist/docs/` (run `npm install` first — `node_modules` is not present in a fresh checkout).

## Commands

```
npm run dev            # dev server, demo mode if no Supabase env
npm run build / start
npm run lint           # eslint
npm run test           # vitest run (all **/*.test.ts, node env)
                       # if "Cannot find native binding": npm i --no-save @rolldown/binding-win32-x64-msvc@<rolldown version>
npx tsc --noEmit       # typecheck (pre-deploy check per README)
npm run create-user -- "email" "password"   # Supabase Auth admin create; needs .env.local
```

Run a single test: `npx vitest run lib/pricing/engine.test.ts`.

## Layout

```
proxy.ts                    request gate → lib/supabase/middleware.ts (auth, prod demo-guard, /present rate limit + no-store)
app/(app)/                  signed-in shell: dashboard, projects, design-studio, cost-catalogue, settings
app/login/                  sign-in (outside shell)
app/present/[token]/        CLIENT link: no login, token is the only credential
app/get-quote/              PUBLIC self-serve form, one page, 7 tabs (Home·Rooms·Package·Photos[optional]·Details·Estimate·Reimagined): renders start in the background for rooms WITH a photo when leaving Photos; /finalize returns the estimate+breakdown (no result page/endpoint)
app/api/public/quote/…      public, token-gated lead APIs (create lead, per-room upload+generate, consult)
app/(app)/boq, /leads       staff BOQ builder (editable lines → .xlsx) and submitted-quote list; app/api/boq/{build,from-brief,quantify,export}
app/presentation/…          designer's own full-screen view (login required)
app/projects/[id]/preview/  designer previews the client view, read-only
app/api/projects/[projectId]/rooms/[roomId]/{analyze,concepts,estimate}/route.ts
components/ui/              shadcn primitives; feature folders beside it
components/motion/          Develop, BrandReveal, CountUp, Pop (GSAP) + SmoothScroll (Lenis, client-facing only). Studio page/list entrances are CSS (`template.tsx`, `.reveal`); `RouteProgress` + `(app)/loading.tsx` answer every click instantly; list pages use `repo.listProjectSummaries()` (never `listProjects()` for lists); `getCurrentUser` is React-`cache`d per request
lib/
  config.ts                 which integrations are configured (isDemoMode etc.)
  auth.ts                   getCurrentUser / requireUser / requirePageUser
  data/                     Repository interface (types.ts) + demo-store (JSON) + supabase-store; get via getRepository()
  actions/                  "use server" actions (CRUD, auth, presentation links)
  ai/                       claude.ts (vision analysis, tool-use + Zod), schemas.ts, errors.ts
  image-gen/                provider interface + demo/stability/openai providers, prompt-builder
  pricing/engine.ts         pure estimate math
  presentation/             DTOs: internal data → client-safe types
  presentation-links/       token crypto, resolve (service-role), designer ops, preview
  leads/service.ts          public quote flow (service-role, token-scoped): createLead, processRoom, getQuoteResult
  quote/                    constants (tiers, rooms, cities), estimate.ts (range = BOQ total × 0.92–1.12 + customer-safe breakdown), format.ts (client-safe), schema.ts (zod)
  rates/                    spazay-data.ts (GENERATED selling-rate card, ids `<sheet>:<code>`), catalog.ts (getRate; + 3 provisional `al:*` allowances with no card rate), sheets.ts (RateSheet spazay|livspace|both, verified Livspace equivalents, GST strip), livspace-benchmarks.ts (cross-check only)
  boq/                      build.ts (room×tier scope → lines; ASSUMPTIONS live here), lists.ts (frozen trades/rooms/items/UOM), xlsx.ts (exceljs, reference layout), schema.ts, lead.ts, brief.ts (plan rooms + requirement items → quantified lines; all qty/₹ computed here), measure.ts
  ai/boq-brief.ts           vision step: plan image + photos + requirements → rooms/dims + rate-card items (reads only; never prices)
  motion.ts                 gsap+ScrollTrigger+useGSAP registration, MOTION_OK/REDUCED media queries, EASE
  rate-limit.ts             in-memory limiter behind RateLimiter interface
  storage.ts                photo/concept upload + short-lived signed URLs
supabase/migrations/        0001 init+RLS, 0002 presentation links, 0003 design_brief/storage_path, 0004 public quote leads, 0005 project links (leads.project_id, boqs)
scripts/create-user.ts      operator CLI (service-role)
```

## Rules that matter

- **Demo mode**: no Supabase env → `DemoRepository` writes `.data/demo-db.json`; AI says key is missing (never fabricates); demo image provider returns labeled placeholder. In `NODE_ENV=production` without Supabase, `proxy.ts` returns 503. All three Supabase vars must be set to leave demo mode.
- **Everything goes through `getRepository()`** (`lib/data/index.ts`). Don't import a store directly. New persistence = add to `Repository` interface and implement in *both* stores.
- **Auth is layered**: proxy + `requireUser()`/`getCurrentUser()` in every Server Action and API route + RLS. New actions/routes must call it. API routes return JSON 401, never redirect. Use `getUser()`, never `getSession()`.
- **Service-role key**: only `lib/presentation-links/token.ts` and `lib/leads/service.ts` (running app) plus `scripts/create-user.ts`. Don't add more. `lib/leads/service.ts` must stay scoped to a lead resolved from a token (`resolveLead`). Everything there must scope by the resolved link's `projectId` and re-verify the project→room→concept chain.
- **Public quote flow** (`/get-quote`, `/api/public/*`): anonymous, so cost/abuse guards are mandatory: honeypot, IP + per-lead rate limits, ≤12 rooms/lead, ≤6 rooms with a photo/AI image per lead (`MAX_PHOTO_ROOMS`, DB-counted in `processRoomOnce`), ≤2 photos/room, `QUOTE_DAILY_IMAGE_CAP` (DB-counted, default 100), AI only after contact capture, estimate always recomputed server-side. The estimate is the sum of a generated BOQ (`lib/boq/build.ts`, qty × Spazay rate) — never a score clamped into a band. **Pricing**: spec mode (quote + `/boq` quick estimate) is package-priced to the sheet: `packageFactor()` in `build.ts` is one multiplier on every rate so a BHK's standard room set lands in `PACKAGE_BANDS` (small 0.35 / unknown 0.5 / large 0.75 of the band); plan mode prices at card/`pr:*`/`al:*` rates, uncalibrated. No city factor (`CITY_RATE_FACTORS` in `build.ts` is empty until a verified policy exists; non-NCR cities get a warning via `cityNote()`). Tier changes specification/scope (`SPEC`, `tierScale`); the band sets the price level. Spec-mode sizes live in `lib/boq/standards.ts` (rooms scale with carpet area ÷ the BHK's standard set; all lines `qtySource: "estimated"`; `specAssumptions()` prints them). Every line has `qtySource` measured|entered|estimated (plan mode derives it from plan-room source / designer-written size; the workbench marks edits "entered"). `lib/boq/validate.ts` = live warnings (units, dims, qty vs dims, duplicates, rate drift, provisional, estimated count) + `sanityChecks()` per-sq-ft/tier-band warnings vs `PACKAGE_BANDS` (UNVERIFIED reference data, warnings only, never adjust a price). Livspace: an unmapped id/unit is billed at Spazay with a `rateNote` (shown in the workbench and on Scope Coverage), never silently substituted. Internal cost layer `lib/rates/costs.ts` (material/labour/hardware/installation, margin vs markup policy) is EMPTY by design: no verified cost data, no default margin; breakdowns report "unavailable". Plan-driven BOQ (`brief.ts`) shares the same rates; room sizes / quantities / city factor in `build.ts` are placeholders to overwrite with real estimator data. Customer-facing breakdown shows trades, rooms and published rates only — no cost/margin.
- **Ownership checks**: any mutation taking `projectId`+`roomId`(+`photoId`/`conceptId`) must verify the chain first (`assertRoomInProject` in supabase-store).
- **Client-safe boundary**: client-facing pages render only `lib/presentation/*` DTO types. Never add cost/margin/supplier/internal-notes fields to them; `estimate_versions` has no cost columns by design. Tests in `dto.test.ts` / `token.test.ts` enforce it.
- **BOQ**: `/boq` + `/api/boq/*` are staff-only (JSON 401). Export recomputes nothing client-trusted: Amount is an `I*J` formula in the sheet. Lead prefill (`lib/boq/lead.ts`) uses the signed-in session + RLS, NOT the service-role client. Plan-driven BOQ (`/api/boq/from-brief`, paid, 10/hr/user): the model only reads rooms/dimensions and picks rate-card ids; `lib/boq/brief.ts` computes every quantity and rupee, drops unknown ids with a warning. Unpriceable requirements surface as `unpriced`, never guessed. "Delete BOQ" clears the working BOQ (undo toast). **Everything hangs off a project** (migration `0005`): a BOQ is saved only under a project (`boqs` table via `repo.saveBoq`, `/api/boq/save`, `/boq?project=…&boq=…`); a lead gets its project (+ rooms) when finalized (`lib/leads/project.ts`, client passed in so no new service-role module) or on staff "Create project" (`openLeadProjectAction`, session client); design rooms/concepts were already per project. Code tolerates 0005 not yet applied (empty BOQ list / no project_id) — apply it in the Supabase SQL editor.
- **Image generation, two flows**: public client flow (`lib/leads/service.ts`) = one photo + the customer's ideas, unchanged. Designer flow (`/api/projects/.../concepts`) = all room photos (main + ≤2 angles) + client notes/room size + design brief + styling brief + project floor plan (`lib/floor-plan.ts`, one per project at `floorplans/<projectId>/plan` in the private bucket, no table). Extra prompt sections are opt-in fields on `buildConceptEditInstruction`, so the client prompt stays identical (tested).
- **Rate sheet** (`lib/rates/sheets.ts`): the designer BOQ picks `spazay` (default) / `livspace` / `both` (bill Spazay, show Livspace ref). Livspace is a small hand-verified map (PDF is unparseable in bulk); unmapped ids fall back to Spazay and each line records `rateSource`. Livspace prices are incl. 18% GST and stripped. The public quote flow never passes a sheet (always Spazay). Provisional `al:*` allowances print flagged and list on the Scope Coverage sheet.
- **BOQ parity with the professional** (`expected_BOQ/`, `PLAN_BOQ_V3.md`): `SCOPE_RULES` in `lib/ai/boq-brief.ts` feeds both AI prompts; `quantify()` adds wallpaper→oil-primer, nets repaint against panelled features, applies `sides`, lump-sum minimums, deep-clean only (floor protection opt-in). `lib/boq/apex.test.ts` pins the Apex brief against the professional's lines. Second sample (`boq_sample2/`, Greenwoods villa): a modular unit is ONE all-in line (carcass+shutter+hardware, `mod:unit`, code `C06+S04+H02`); Master BOQ has **no blank/room-only rows** (no spare rows; room header carries only a count) and splits **Annexure A (fixed & modular)** / **Annexure B (loose furniture)** with subtotals + Grand Total; each line has `area` (plan label) and `remarks` (estimator note, kept out of `description`); Terms & Conditions sheet; provisional `al:RAILING`/`al:JACUZZI`. Pinned by `lib/boq/greenwoods.test.ts`. **Unit classes** (`lib/boq/classes.ts`): the plan-analysis step picks a closed vocabulary (`unit: "wardrobe" | "kitchen_cabinetry" | …`), the server fixes the rate (estimator `pr:*` project rates in `lib/rates/catalog.ts`, all-in, premium grade, scaled by tier for modular) and sizes it from the plan rooms unless the designer wrote a size (number + unit in the requirement) — the model's own width/height are ignored except for plan-measured classes (`aiSized`). `once` classes are de-duplicated per room/level. Whole-home paint lines are coerced to `fresh_paint`. The `unpriced` list is reconciled against coverage (`reconcileUnpriced`). **Consensus** (`lib/boq/consensus.ts`): Manus runs `BOQ_CONSENSUS_RUNS` (default 3, 1 disables) independent analyses under one dotted task id and the median-total run is used whole (item-level voting was tried: -5% / +20%). Env: `BOQ_CONSENSUS_RUNS`. Calibration: two live runs of the Greenwoods plans land within ±5% of the professional total (fixed ±6%); sizes are fitted to two jobs — re-fit on new professional BOQs.
- **Photos**: private bucket; persist only `storage_path`, mint ~10 min signed URLs on read. Deleting a photo must remove the storage object.
- **Server Actions** return `ActionResult<T>` (`{ok:true,data}|{ok:false,error}`), validate with Zod, call `revalidatePath`. **API routes** (AI/pricing) validate body with Zod and return `{error, code}` with real HTTP status; rate-limit expensive ones (concepts: 15/hr/user).
- **Pricing**: margin-based, not markup (40% margin ≠ 40% markup); GST on selling subtotal; keep engine pure and tested.
- **`server-only`** is stubbed in Vitest (`test/stubs/server-only.ts`); server modules import it normally. Config is `vitest.config.mts` (must be `.mts`; `.ts` loads as CJS and fails on Node 22).
- **`<Button render={<Link/>}>`**: `components/ui/button.tsx` sets `nativeButton={false}` whenever `render` is passed (Base UI warns otherwise). Don't pass `render` a real `<button>` without overriding it.
- **Secrets**: `OPENAI_API_KEY`/`STABILITY_API_KEY` are read only in `server-only` provider files. Never prefix with `NEXT_PUBLIC_`.
- **Motion**: GSAP only inside `gsap.matchMedia().add(MOTION_OK, …)` (reduced-motion users get none). Lenis only on `/get-quote` (nested scroll areas in the app fight it). Server components pass named formatters to `CountUp` (`"int"|"lakh"`), never functions.
- Rate limiter is per-process; wrong for multi-instance/serverless — swap via `getRateLimiter()` before scaling.

## Env

`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL` (default `claude-sonnet-5`), `IMAGE_GENERATION_PROVIDER` (`demo|stability|openai`), `STABILITY_API_KEY`, `OPENAI_API_KEY`, `QUOTE_DAILY_IMAGE_CAP`. `.env*` and `.data/` are git-ignored. No `.env.example` exists despite README mentioning one.

## Deploy (Hostinger)

Live at https://tools.innerspacio.com (Hostinger Node.js, user `u731638769`). Deploy = tar source (exclude `node_modules .next .data .env* innerspacio_tool .git .claude`) → `hosting_deploy-js-application`. Env vars set via `hosting_nodejs_replace-environment-variables` (full replace; NEXT_PUBLIC_* need rebuild). Build is `next build --webpack` + `postcss.config.mjs` + `@tailwindcss/postcss`: Turbopack's CSS loader process crashes on the host ("node process exited ... status 0"). Don't go back to `turbopack.rules`/`@tailwindcss/turbopack`. Host defaults Node 20; Supabase wants 22 (warns only).

GitHub: `origin` = github.com/shishir349/innerspacio_tool (branch `main`). `references/` (third-party screenshots) is git-ignored.

## Known gaps / gotchas

- README documents Phase 1 and 3; Design Studio (`/design-studio`, migration `0003`, `components/design-studio/*`, `RoomDesignBrief`) is newer and not in README yet.
- No forgot-password flow, no `/login` rate limit, single trust tier (all signed-in users see all projects), no PDF export.

## Maintaining this file

Update when you: add a route/top-level `lib/` module, a migration, an env var, a command, or a new security invariant; or when a rule above stops being true. Keep it short — link to README for detail instead of copying it.
