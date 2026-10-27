# Deployment guide

Order matters: **Supabase → backend (Render) → frontend (Vercel) → CORS → verify**. None of these steps has been executed by the authors of this repository; treat the first deployment as a test.

## 1. Supabase
1. Create a project. Note the **Project URL**, **anon key** and **service_role key** (Settings → API).
2. SQL Editor → run `database/migrations/001_schema.sql`, `002_rls.sql`, then `database/seed/001_seed.sql`.
3. Authentication → Providers → Email enabled. In production keep “Confirm email” **on**. Set Site URL to your Vercel URL and add it to Redirect URLs.
4. Promote the first admin (see `database/README.md`).
5. Optional: enable `pg_cron` and schedule the search-history purge from `database/README.md`.

## 2. Backend on Render
- New → Blueprint, pointing at this repo (uses `render.yaml`), or create a Web Service manually:
  - Root directory `backend`, build `npm ci && npm run build`, start `npm start`, health check `/health`.
- Environment variables:

| Variable | Value |
|---|---|
| `NODE_ENV` | `production` |
| `SUPABASE_URL` | Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role key (**secret**, backend only) |
| `CORS_ORIGINS` | your exact frontend origin(s), comma separated, e.g. `https://dpsn.vercel.app` (no trailing slash) |
| `AI_PROVIDER` / `AI_API_KEY` / `AI_MODEL` | optional; `none` by default |
| `RATE_LIMIT_MAX`, `AI_DAILY_LIMIT_PER_IP`, `AI_TIMEOUT_MS` | optional tuning |

In production the server **refuses to start** if Supabase is not configured, so it can never silently serve demo data with sign-in disabled.
Render free instances sleep when idle; the first request after a pause is slow.
Note: the AI daily limit and rate limits are in memory per instance. If you run more than one instance, move them to a shared store.

## 3. Frontend on Vercel
- Import the repo, **Root Directory `frontend`**, framework Vite, build `npm run build`, output `dist`.
- Environment variables (public by design): `VITE_API_BASE_URL` (your Render URL), `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
- `frontend/vercel.json` provides the SPA rewrite and basic security headers.
- Never put the service_role key or an AI key in a `VITE_` variable: they are shipped to browsers.

## 4. Verify
```bash
curl https://<api>/health                       # {"status":"ok","supabase":true,...}
curl "https://<api>/api/services?q=pension"     # demonstration records
curl -i https://<api>/api/admin/services        # must be 401
```
Then in the browser: search, open a service, run the eligibility check, sign up, save a service, create a checklist; sign in as the promoted admin and open `/admin`.

## Troubleshooting
| Symptom | Likely cause |
|---|---|
| Browser console: CORS error | `CORS_ORIGINS` missing the exact origin (scheme + host, no slash); redeploy backend |
| Sign-in button disabled / “not configured” | `VITE_SUPABASE_*` still placeholders; rebuild frontend after changing env |
| Signed in but API returns 401 | backend `SUPABASE_URL`/service key belong to a different project than the frontend |
| `/admin` shows “Access denied” | account not promoted; role is read from `profiles.role_id` |
| 404 on page refresh (Vercel) | `vercel.json` rewrite missing, or Root Directory not `frontend` |
| Backend exits at boot in production | Supabase variables missing (intentional) |
| Slow first request | free-tier cold start |
| `generation expression is not immutable` | you are running an older copy of 001; use the version with `immutable_tags_text` |

## Windows notes
Use PowerShell for the commands in the README. If scripts are blocked: `Set-ExecutionPolicy -Scope Process Bypass`. Playwright on Windows: `npx playwright install chromium`.
