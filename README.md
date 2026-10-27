# Digital Public Service Navigator

*Government Services, Made Simple.*

An independent guide to Indian government schemes and services: search a directory, check preliminary eligibility with a transparent rules engine, see required documents and steps, and jump to the **official** portal. **It is not an official government website, it cannot submit applications, and it does not access government records.**

> **Content status:** all seeded services are **demonstration records** (verification status `demonstration`). Nothing in this repository has been verified against live government sources. A reviewer must verify a record through the admin workflow before it is shown as verified.

## What works without any external service
The backend starts with **no Supabase and no AI key**, serving the demonstration data from memory. Search, filters, service details, the eligibility checker, the keyword/deterministic assistant, and the English/Hindi interface all work. Sign-in, saved services, checklists, preferences and the admin area need Supabase (see below).

## Repository layout
```
backend/    Express + TypeScript API (routes, services, repositories, middleware, validators)
frontend/   React + Vite + TypeScript + Tailwind SPA
database/   SQL migrations, RLS policies, seed data, RLS tests
docs/       Architecture, deployment, security/privacy, demo workflow, project report
tests/e2e/  Playwright specs
```

## Quick start (no accounts needed)

**macOS / Linux / Git Bash**
```bash
npm run install:all
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
npm run dev:backend      # terminal 1 → http://localhost:4000  (docs at /api/docs)
npm run dev:frontend     # terminal 2 → http://localhost:5173
```

**Windows (PowerShell)**
```powershell
npm run install:all
Copy-Item backend\.env.example backend\.env
Copy-Item frontend\.env.example frontend\.env
npm run dev:backend      # terminal 1
npm run dev:frontend     # terminal 2 (open a second PowerShell window)
```
Requires Node.js 20+. Leave the Supabase placeholders as they are to run in demo mode.

## Enable accounts, checklists and admin (Supabase)
1. Create a Supabase project. In **SQL Editor** run, in order: `database/migrations/001_schema.sql`, `002_rls.sql`, `database/seed/001_seed.sql`.
2. Copy the project URL, `anon` key and `service_role` key into the two `.env` files (`service_role` goes **only** in `backend/.env`).
3. Authentication → Providers → Email: enable. For local testing you may turn off “Confirm email”.
4. Sign up in the app, then promote yourself once (see `database/README.md`).
5. Restart the backend. `/health` should now report `"supabase": true`.

## Optional AI
Set `AI_PROVIDER` (`anthropic` or `openai`), `AI_API_KEY` and `AI_MODEL` in `backend/.env`. The model only rephrases records the retriever found and is told to cite them and answer “Information not verified” when unsure. On timeout, error or rate limit the app silently returns the deterministic answer. Eligibility is **never** decided by the model.

## Checks
```bash
npm run check            # backend typecheck+lint+tests, frontend build+lint+tests
npm run e2e              # Playwright (starts both servers; needs a Chromium)
bash database/tests/run_local.sh   # RLS tests; needs a disposable local Postgres (PGHOST/PGPORT/PGUSER)
```
If Playwright cannot find a browser, run `npx playwright install chromium` or set `PW_CHROMIUM` to a Chromium executable.

## Test status (last run in the build environment)
| Check | Result |
|---|---|
| Backend typecheck, lint | clean |
| Backend unit/API tests (Vitest + Supertest, in-memory repository) | 45 passed |
| Frontend typecheck, lint, production build | clean |
| Frontend tests (Vitest + Testing Library) | 11 passed |
| Playwright, anonymous visitor flows | 6 passed |
| SQL migrations + seed + RLS assertions on PostgreSQL 16 (stand-in `auth` schema) | passed |

## Not verified / known gaps
- **Not run against a live Supabase project:** `SupabaseRepo`, Supabase Auth/JWT verification and PostgREST behaviour are type-checked but untested against the real service.
- **Signed-in end-to-end journey not automated:** saving a service, creating a checklist and editing as an admin are covered by API tests on the in-memory repository, not by browser tests (they need a Supabase project and test accounts).
- **Not deployed:** Vercel/Render configs are provided but unexercised.
- **LLM provider calls untested** against real APIs; only the failure/fallback path is tested.
- **Accessibility:** built to WCAG 2.2 AA guidance (semantic HTML, labels, focus, skip link, reduced motion) but no automated audit (axe/Lighthouse) or screen-reader pass has been run.
- **Hindi:** interface strings are partial and machine-assisted, need native-speaker review. No service translations exist yet; the UI says so and shows English.
- Official URLs are root portals only. Deep links are intentionally empty until a reviewer verifies them. Link-health checking is a manual status field, not an automated crawler.
- Privacy notice and terms are drafts requiring legal review (see `docs/SECURITY_PRIVACY.md`).

## Design system (editorial redesign)
Tokens live in `frontend/src/styles/tokens.css` (palette, type, motion) and are mapped in `tailwind.config.js`. Headings use Clash Display and body text Satoshi, loaded from Fontshare in `frontend/index.html`; if that CDN is unreachable the app falls back to self-hosted Inter, Instrument Serif (italic accent) and Noto Sans Devanagari. Reusable pieces: `TypographicEcho`, `Reveal`, `PillShowcase`, `ServiceCard`/`ServiceGrid`, `SiteHeader`/`SiteFooter`. Motion respects `prefers-reduced-motion`.

## Docs
`docs/ARCHITECTURE.md` · `docs/DEPLOYMENT.md` · `docs/SECURITY_PRIVACY.md` · `docs/DEMO_WORKFLOW.md` · `docs/PROJECT_REPORT.md` · API reference at `/api/docs` (OpenAPI JSON at `/api/openapi.json`).
