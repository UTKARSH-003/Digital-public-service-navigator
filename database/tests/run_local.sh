#!/usr/bin/env bash
# Applies migrations + seed to a scratch database and runs the RLS tests.
# Usage: PGHOST=... PGPORT=... PGUSER=postgres ./database/tests/run_local.sh
# The target must be a disposable Postgres server (it creates and drops a database named dpsn_test).
set -euo pipefail
cd "$(dirname "$0")/../.."
P="psql -v ON_ERROR_STOP=1 -q"
$P -d postgres -c "drop database if exists dpsn_test" -c "create database dpsn_test"
P="$P -d dpsn_test"
$P <<'SQL'
do $$ begin
  if not exists (select from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
end $$;
-- Minimal stand-in for Supabase's auth schema and default privileges
create schema auth;
create table auth.users (id uuid primary key default gen_random_uuid(), email text);
create function auth.uid() returns uuid language sql stable as $f$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $f$;
grant usage on schema public, auth to anon, authenticated;
alter default privileges in schema public grant all on tables to anon, authenticated;
alter default privileges in schema public grant all on sequences to anon, authenticated;
alter default privileges in schema public grant all on functions to anon, authenticated;
SQL
$P -f database/migrations/001_schema.sql
$P -f database/migrations/002_rls.sql
$P -f database/seed/001_seed.sql
$P -f database/tests/rls_test.sql
