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
npm run test           # vitest run (all **/*.test.ts, node env); 140 tests
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
app/get-quote/              PUBLIC self-serve wizard (photos+ideas → AI image per room → tiered estimate); result at /get-quote/result/[token]
app/api/public/quote/…      public, token-gated lead APIs (create lead, per-room upload+generate, consult)
app/(app)/boq, /leads       staff BOQ builder (editable lines → .xlsx) and submitted-quote list; app/api/boq/{build,from-brief,quantify,export}
app/presentation/…          designer's own full-screen view (login required)
app/projects/[id]/preview/  designer previews the client view, read-only
app/api/projects/[projectId]/rooms/[roomId]/{analyze,concepts,estimate}/route.ts
components/ui/              shadcn primitives; feature folders beside it
components/motion/          Reveal, CountUp, Pop, PageFade (GSAP) + SmoothScroll (Lenis, /get-quote only)
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
  rates/                    spazay-data.ts (GENERATED selling-rate card, ids `<sheet>:<code>`), catalog.ts (getRate), livspace-benchmarks.ts (cross-check only)
  boq/                      build.ts (room×tier scope → lines; ASSUMPTIONS live here), lists.ts (frozen trades/rooms/items/UOM), xlsx.ts (exceljs, reference layout), schema.ts, lead.ts, brief.ts (plan rooms + requirement items → quantified lines; all qty/₹ computed here), measure.ts
  ai/boq-brief.ts           vision step: plan image + photos + requirements → rooms/dims + rate-card items (reads only; never prices)
  motion.ts                 gsap+ScrollTrigger+useGSAP registration, MOTION_OK/REDUCED media queries, EASE
  rate-limit.ts             in-memory limiter behind RateLimiter interface
  storage.ts                photo/concept upload + short-lived signed URLs
supabase/migrations/        0001 init+RLS, 0002 presentation links, 0003 design_brief/storage_path, 0004 public quote leads
scripts/create-user.ts      operator CLI (service-role)
```

## Rules that matter

- **Demo mode**: no Supabase env → `DemoRepository` writes `.data/demo-db.json`; AI says key is missing (never fabricates); demo image provider returns labeled placeholder. In `NODE_ENV=production` without Supabase, `proxy.ts` returns 503. All three Supabase vars must be set to leave demo mode.
- **Everything goes through `getRepository()`** (`lib/data/index.ts`). Don't import a store directly. New persistence = add to `Repository` interface and implement in *both* stores.
- **Auth is layered**: proxy + `requireUser()`/`getCurrentUser()` in every Server Action and API route + RLS. New actions/routes must call it. API routes return JSON 401, never redirect. Use `getUser()`, never `getSession()`.
- **Service-role key**: only `lib/presentation-links/token.ts` and `lib/leads/service.ts` (running app) plus `scripts/create-user.ts`. Don't add more. `lib/leads/service.ts` must stay scoped to a lead resolved from a token (`resolveLead`). Everything there must scope by the resolved link's `projectId` and re-verify the project→room→concept chain.
- **Public quote flow** (`/get-quote`, `/api/public/*`): anonymous, so cost/abuse guards are mandatory: honeypot, IP + per-lead rate limits, ≤6 rooms/lead, ≤2 photos/room, `QUOTE_DAILY_IMAGE_CAP` (DB-counted, default 100), AI only after contact capture, estimate always recomputed server-side. The estimate is the sum of a generated BOQ (`lib/boq/build.ts`, qty × Spazay rate) — never a score clamped into a band. Tier bands in `lib/quote/constants.ts` (Essential 15–20L, Premium 20–55L, Luxury 55–90L) are calibration targets pinned by `lib/boq/build.test.ts`; room sizes / quantities / city factor in `build.ts` are placeholders to overwrite with real estimator data. Customer-facing breakdown shows trades, rooms and published rates only — no cost/margin.
- **Ownership checks**: any mutation taking `projectId`+`roomId`(+`photoId`/`conceptId`) must verify the chain first (`assertRoomInProject` in supabase-store).
- **Client-safe boundary**: client-facing pages render only `lib/presentation/*` DTO types. Never add cost/margin/supplier/internal-notes fields to them; `estimate_versions` has no cost columns by design. Tests in `dto.test.ts` / `token.test.ts` enforce it.
- **BOQ**: `/boq` + `/api/boq/*` are staff-only (JSON 401). Export recomputes nothing client-trusted: Amount is an `I*J` formula in the sheet. Lead prefill (`lib/boq/lead.ts`) uses the signed-in session + RLS, NOT the service-role client. Plan-driven BOQ (`/api/boq/from-brief`, paid, 10/hr/user): the model only reads rooms/dimensions and picks rate-card ids; `lib/boq/brief.ts` computes every quantity and rupee, drops unknown ids with a warning. Unpriceable requirements surface as `unpriced`, never guessed. "Delete BOQ" clears the working BOQ (undo toast). No BOQ table yet (export-first); add one if designers must resume edits.
- **Image generation, two flows**: public client flow (`lib/leads/service.ts`) = one photo + the customer's ideas, unchanged. Designer flow (`/api/projects/.../concepts`) = all room photos (main + ≤2 angles) + client notes/room size + design brief + styling brief + project floor plan (`lib/floor-plan.ts`, one per project at `floorplans/<projectId>/plan` in the private bucket, no table). Extra prompt sections are opt-in fields on `buildConceptEditInstruction`, so the client prompt stays identical (tested).
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
