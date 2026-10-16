# Product

## What this is
InnerSpacio AI Studio: the tool InnerSpacio's interior designers use in client meetings, plus the two client-facing surfaces it feeds.

- **Studio (staff, signed in):** projects, Design Studio (photo → AI analysis → concepts → estimate), BOQ builder, leads inbox, cost catalogue, settings. *Mode: Operate.*
- **Showroom (public / client):** `/get-quote` self-serve estimate wizard (*Persuade*), `/get-quote/result/[token]` (*Persuade*), `/present/[token]` client presentation (*Experience*), `/login`.

## Users
- **Designers and estimators** at InnerSpacio: daily, desktop-first, speed and density matter, they live in the BOQ table.
- **Prospective clients** arriving from innerspacio.com "Estimate": mostly on phones, emotional ("our home"), need trust and clarity, never see costs or margins.
- **Existing clients** opening a presentation link: want to see their rooms beautifully, choose, approve.

## Brand truth
InnerSpacio: "Your space, your story." Residential interior design and execution in Delhi NCR, 25+ residential projects led by an in-house team. The brand world is innerspacio.com: warm limestone canvas, dark-brown ink, walnut pills, olive/terracotta/gold material cards, a single saffron signal, high-contrast display serif, condensed caps labels.

## Non-negotiables (carried through any redesign)
- Client-facing pages render only the allowlisted DTOs; no cost, margin, supplier or internal notes.
- Public flow guards stay: honeypot, rate limits, ≤6 rooms, ≤2 photos/room, daily image cap, estimate recomputed server-side.
- Staff routes return JSON 401, never redirect; RLS + proxy + `requireUser()` layering unchanged.
- Everything hangs off a project (leads, BOQs, design rooms).
- Reduced-motion users get a complete static experience; Lenis only on client-facing routes.

## Anti-references
The previous look (ivory + sage + Fraunces/Inter, sidebar app shell) is replaced, not polished. Generic SaaS dashboards, glassy gradients, and stock-photo hero sections are out.
