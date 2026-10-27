# Project report: Digital Public Service Navigator

## 1. Problem
Citizens struggle to find the right government scheme, understand eligibility, know which documents to gather and reach the correct official portal. Information is scattered and written in complex language.

## 2. Objectives
Provide one accessible interface to discover services, get a preliminary and transparent eligibility indication, see documents and steps, reach the official source, and keep personal progress, while never misrepresenting itself as a government site and never inventing facts.

## 3. Methodology
- Requirements and risk analysis first (`ARCHITECTURE.md`): accuracy, privacy and authorization were treated as core requirements.
- Layered backend (routes → services → repositories) behind a `Repo` interface with two implementations: Supabase for production and an in-memory one for tests and zero-setup demos. This is what makes the “works with no external service” requirement testable.
- Deterministic JSON rules engine for eligibility; LLM optional and limited to rephrasing retrieved records.
- Defence in depth: backend role checks plus database RLS.
- Test-first on risky logic (eligibility edge cases, authorization matrix, CSV hostility), then browser and database-level tests.

## 4. Architecture
See `ARCHITECTURE.md` for the component and ER diagrams. React SPA (Vercel) → Express API (Render) → Supabase Auth/Postgres. Retrieval for the assistant is keyword/synonym scoring over published records.

## 5. Features delivered
Public home and directory (search, filters, sort, pagination, debounced input); service detail with verification status; per-service dynamic eligibility questionnaire with three outcomes, reasons and missing facts; assistant with intent detection, retrieval, citations, clarifying questions, related services and fallback; transparent recommendation scoring with reasons and consent gating; accounts, saved services, checklists, reference numbers, print; profile with consent, data export and account deletion; admin dashboard (overview, services CRUD, editor with rules/documents/steps/sources, verification queue, feedback review, audit log, CSV import/export); English interface with partial Hindi and fallback labelling; accessibility foundations.

## 6. Verification performed
| Check | Result |
|---|---|
| Backend typecheck + lint | clean |
| Backend tests | 45 passed |
| Frontend typecheck + lint + build | clean |
| Frontend tests | 10 passed |
| Playwright (anonymous flows incl. admin blocking) | 6 passed |
| SQL migrations, seed, RLS assertions on PostgreSQL 16 | passed |
Defects found and fixed by these checks: non-immutable generated column in the migration; a form `Select` that could not register with react-hook-form; a role-detection approach that could not distinguish reviewers from super admins (replaced by `/api/me`); a checklist “add item” control that initially did nothing.

## 7. Limitations
Seed content is demonstration only and unverified. No live Supabase, deployment, LLM-provider or signed-in browser test was run. Hindi is partial and unreviewed. No automated accessibility audit. In-memory rate limits. Link checking is manual. Legal review of privacy/terms is outstanding.

## 8. Future scope
Reviewer-verified real records with deep links; scheduled link-health checks and re-verification reminders; more Indian languages and professionally reviewed translations; embeddings-based retrieval over approved records; signed-in Playwright suite with seeded Supabase test project; shared rate-limit store; email reminders for user-chosen deadlines; DigiLocker or other integrations only if and when authorised APIs are available.
