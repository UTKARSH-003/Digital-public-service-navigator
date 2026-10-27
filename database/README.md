# Database

| File | Purpose |
|---|---|
| `migrations/001_schema.sql` | Tables, constraints, indexes, triggers (run first) |
| `migrations/002_rls.sql` | Role helper functions, RLS policies, column grants (run second) |
| `seed/001_seed.sql` | 12 categories and 6 **demonstration** services. None is marked verified. |
| `tests/rls_test.sql` | Assertions for RLS, privilege escalation, constraints, account deletion |
| `tests/run_local.sh` | Runs everything above against a **disposable** local Postgres with a stand-in `auth` schema |

## Apply to Supabase
SQL Editor → paste and run `001`, then `002`, then the seed. Or with the CLI: `supabase db push` after copying the files into `supabase/migrations/`.

## First administrator
Role changes are deliberately not possible from the browser. After the first user signs up, promote them once in the SQL editor:

```sql
update public.profiles set role_id = 2   -- 2 = super_admin, 3 = content_admin, 4 = reviewer
where id = (select id from auth.users where email = 'you@example.com');
```
After that, a super admin can change other users' roles through `PATCH /api/admin/users/:id/role`.

## Retention
Anonymous search history older than 90 days should be purged. With `pg_cron` enabled:
```sql
select cron.schedule('purge-search-history', '0 3 * * *', $$delete from public.search_history where created_at < now() - interval '90 days'$$);
```

## Notes
- `immutable_tags_text()` exists because Postgres refuses `array_to_string` inside a generated column.
- Deleting an `auth.users` row cascades to the profile and every user-owned table; feedback and search history are anonymised (`ON DELETE SET NULL`).
