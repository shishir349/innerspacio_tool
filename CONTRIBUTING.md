# Contributing

1. `git clone https://github.com/shishir349/innerspacio_tool.git && cd innerspacio_tool && npm install`
2. `cp .env.example .env.local` (leave Supabase blank for demo mode) then `npm run dev`.
3. Read `CLAUDE.md` (architecture and the rules that matter) and `AGENTS.md`. Next.js 16 differs from older versions.
4. Branch from `main` (`git switch -c feature/<name>`), keep changes small, open a PR.
5. Before a PR: `npx tsc --noEmit`, `npm run lint`, `npm run test`, `npm run build`.

If tests fail with "Cannot find native binding": `npm i --no-save @rolldown/binding-win32-x64-msvc@<rolldown version>` (Windows).

## Not in the repo (ask the owner)
- Secrets: real keys go only in `.env.local` / the host. Never commit them.
- Sample client data (`Img_Samples/`, `boq_sample2/`, `expected_BOQ/`, `your_BOQ/`) and the raw brand `fonts/`.
- Database: apply `supabase/migrations/*` in order in the Supabase SQL editor. `0005_project_links.sql` may be pending.

## Deploys
Production is https://tools.innerspacio.com (Hostinger). Only the owner deploys; see "Deploy" in `CLAUDE.md`.
