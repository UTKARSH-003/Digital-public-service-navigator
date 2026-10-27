# Security and privacy

## Controls implemented (and where)
| Area | Control | Location |
|---|---|---|
| Authentication | Supabase Auth; backend verifies every bearer token with Supabase (`auth.getUser`) and loads the role from `profiles` | `middleware/auth.ts`, `repositories/supabaseRepo.ts` |
| Authorization | `requireRole()` on every `/api/admin` route; editors vs reviewers vs super admin; role changes only by super admin, never self | `app.ts` |
| Database | RLS enabled on all 17 tables; users limited to own rows; drafts hidden; `role_id` not user-writable (column grants) | `database/migrations/002_rls.sql`, tested in `database/tests/rls_test.sql` |
| Validation | Zod on every body/query/param; `.strict()` answers; https-only URLs; bounded sizes | `validators/schemas.ts` |
| CSV import | 512 KB / 500 row limit, per-row validation, all-or-nothing, forced to `draft` + `awaiting_verification`; export neutralises spreadsheet formulas | `services/csv.ts` |
| Abuse | global rate limit, stricter on assistant and feedback, per-IP daily AI cap | `app.ts` |
| Headers / CORS | Helmet with locked-down CSP on the API, CORS allowlist, no `x-powered-by`; frontend headers via `vercel.json` | `app.ts`, `frontend/vercel.json` |
| Errors / logs | JSON errors without stacks; logger redacts tokens, passwords, OTPs, API keys and questionnaire `answers` | `middleware/errorHandler.ts`, `utils/logger.ts` |
| XSS | React escaping, no `dangerouslySetInnerHTML`, assistant text rendered by a bold-only parser, hrefs filtered to `https:` | `pages/Assistant.tsx`, `utils/index.ts` |
| Secrets | service-role and AI keys exist only in backend env; `.env*` git-ignored; only `.env.example` committed | `.gitignore` |
| Audit | create/update/delete/import/verify/feedback/role changes written to `admin_audit_logs`; no update/delete policy makes it append-only for non-service roles | `app.ts`, RLS |

## Privacy design
- **Collected:** email (in Supabase Auth), saved services, checklist items and optional manually entered reference numbers, eligibility **result summaries**, optional preferences (only with consent), anonymous search queries.
- **Not collected:** Aadhaar numbers, OTPs, banking data, identity documents. The assistant refuses OTP/password content, and the UI warns on the relevant screens.
- **Eligibility answers are never stored or logged.** Only outcome, reasons and missing-fact labels are saved, and only if the signed-in user ticks the box.
- **Preferences** are wiped server-side if consent is withdrawn.
- **Rights:** `GET /api/user/export` (download) and `DELETE /api/user/account` (cascades via `auth.users`); feedback and search history are anonymised, not kept with an identity.
- **Retention targets:** account data until deletion; search history 90 days (purge job in `database/README.md`, must be scheduled by the operator).
- Admin analytics are aggregates only and do not include user identifiers.

## Items requiring legal review (not claimed as compliant)
Compliance with the **Digital Personal Data Protection Act, 2023** has not been assessed. Before a public launch have counsel review: notice and consent wording (including Hindi and other languages), retention periods, grievance officer and contact details, children’s data handling (the app does not verify age), cross-border processing by Supabase, Render, Vercel and any AI provider, terms of use, and the use of government names/links. The privacy, terms and contact pages are drafts.

## Known limitations
- Rate limiting and AI quota are per-process memory.
- Brute-force protection of sign-in relies on Supabase Auth settings.
- No malware scanning or file uploads exist (uploads were deliberately not built).
- Link health is a manual status, not a crawler.
- No automated dependency/CVE gating; `npm audit` reports advisories in dev tooling that should be reviewed before release.
- Role is also returned by `/api/me` for UI display; it is not trusted for authorization.
