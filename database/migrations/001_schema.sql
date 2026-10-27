-- Digital Public Service Navigator — schema
-- Run in order: 001_schema.sql, 002_rls.sql, then seed/001_seed.sql

create extension if not exists pg_trgm;
create extension if not exists pgcrypto;

-- Generic updated_at trigger
create or replace function public.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ───────── roles ─────────
create table public.roles (
  id smallint primary key,
  name text not null unique check (name in ('user','super_admin','content_admin','reviewer')),
  description text,
  created_at timestamptz not null default now()
);
insert into public.roles (id, name, description) values
  (1,'user','Regular citizen account'),
  (2,'super_admin','Full administrative access'),
  (3,'content_admin','Create/edit/publish service content'),
  (4,'reviewer','Read-only reviewer');

-- ───────── profiles (1:1 with auth.users) ─────────
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text check (char_length(display_name) <= 80),
  preferred_language text not null default 'en' check (preferred_language in ('en','hi')),
  role_id smallint not null default 1 references public.roles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_profiles_updated before update on public.profiles
  for each row execute function public.set_updated_at();

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id) values (new.id) on conflict do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ───────── user_preferences (optional, consent-based) ─────────
create table public.user_preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  profiling_consent boolean not null default false,
  consent_at timestamptz,
  state_code text check (state_code ~ '^[A-Z]{2}$'),
  age_group text check (age_group in ('under_18','18_25','26_40','41_59','60_plus')),
  occupation text check (occupation in ('student','employed','unemployed','farmer','entrepreneur','homemaker','retired','other')),
  interests text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_prefs_updated before update on public.user_preferences
  for each row execute function public.set_updated_at();

-- ───────── categories ─────────
create table public.service_categories (
  id serial primary key,
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  name_en text not null,
  name_hi text,
  description_en text,
  icon text,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_cat_updated before update on public.service_categories
  for each row execute function public.set_updated_at();

-- array_to_string is only STABLE, which Postgres refuses inside a generated column.
-- For text[] input the result is deterministic, so a thin IMMUTABLE wrapper is safe here.
create or replace function public.immutable_tags_text(t text[]) returns text
language sql immutable parallel safe as $$ select array_to_string(t, ' ') $$;

-- ───────── services ─────────
create table public.government_services (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  name text not null check (char_length(name) between 3 and 200),
  short_description text not null check (char_length(short_description) <= 600),
  category_id int not null references public.service_categories(id),
  government_level text not null check (government_level in ('central','state')),
  state_code text check (state_code is null or state_code ~ '^[A-Z]{2}$'),
  target_beneficiaries text[] not null default '{}',
  fees_text text,
  fees_verified boolean not null default false,
  important_dates_text text,
  dates_verified boolean not null default false,
  application_url text check (application_url is null or application_url ~* '^https://'),
  tags text[] not null default '{}',
  status text not null default 'draft' check (status in ('draft','published','archived')),
  verification_status text not null default 'demonstration'
    check (verification_status in ('demonstration','awaiting_verification','verified','outdated','link_broken')),
  last_verified_at timestamptz,
  verified_by uuid references public.profiles(id) on delete set null,
  next_review_due date,
  search_vector tsvector generated always as (
    setweight(to_tsvector('simple', coalesce(name,'')), 'A') ||
    setweight(to_tsvector('simple', coalesce(short_description,'')), 'B') ||
    setweight(to_tsvector('simple', public.immutable_tags_text(tags)), 'B')
  ) stored,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (government_level = 'central' or state_code is not null),
  check (verification_status <> 'verified' or last_verified_at is not null)
);
create index idx_services_category on public.government_services(category_id);
create index idx_services_state on public.government_services(state_code);
create index idx_services_status on public.government_services(status, verification_status);
create index idx_services_search on public.government_services using gin(search_vector);
create index idx_services_name_trgm on public.government_services using gin(name gin_trgm_ops);
create index idx_services_tags on public.government_services using gin(tags);
create trigger trg_services_updated before update on public.government_services
  for each row execute function public.set_updated_at();

-- ───────── translations ─────────
create table public.service_translations (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references public.government_services(id) on delete cascade,
  language text not null check (language in ('en','hi')),
  name text not null,
  short_description text not null,
  translation_status text not null default 'machine_generated'
    check (translation_status in ('machine_generated','awaiting_review','reviewed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (service_id, language)
);
create trigger trg_trans_updated before update on public.service_translations
  for each row execute function public.set_updated_at();

-- ───────── eligibility rules ─────────
-- rule: field, operator, value. `mandatory=false` means informational guidance only.
create table public.eligibility_rules (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references public.government_services(id) on delete cascade,
  field text not null check (field in ('state_code','age','occupation','annual_income','education_level','gender','category','disability','residency')),
  operator text not null check (operator in ('eq','neq','in','not_in','gte','lte','between')),
  value jsonb not null,
  mandatory boolean not null default true,
  question_text text not null,
  explanation text,
  description text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_rules_service on public.eligibility_rules(service_id, sort_order);
create trigger trg_rules_updated before update on public.eligibility_rules
  for each row execute function public.set_updated_at();

-- ───────── required documents ─────────
create table public.required_documents (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references public.government_services(id) on delete cascade,
  name text not null,
  notes text,
  is_mandatory boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_docs_service on public.required_documents(service_id, sort_order);
create trigger trg_docs_updated before update on public.required_documents
  for each row execute function public.set_updated_at();

-- ───────── application steps ─────────
create table public.application_steps (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references public.government_services(id) on delete cascade,
  step_number int not null check (step_number > 0),
  title text not null,
  details text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (service_id, step_number)
);
create trigger trg_steps_updated before update on public.application_steps
  for each row execute function public.set_updated_at();

-- ───────── official sources (separate from application URL) ─────────
create table public.official_sources (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references public.government_services(id) on delete cascade,
  title text not null,
  url text not null check (url ~* '^https://'),
  domain text generated always as (lower(substring(url from '^https://([^/]+)'))) stored,
  is_primary boolean not null default false,
  last_checked_at timestamptz,
  link_status text not null default 'unchecked' check (link_status in ('unchecked','ok','broken')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (service_id, url)
);
create index idx_sources_service on public.official_sources(service_id);
create trigger trg_sources_updated before update on public.official_sources
  for each row execute function public.set_updated_at();

-- ───────── verification logs ─────────
create table public.service_verification_logs (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references public.government_services(id) on delete cascade,
  reviewer_id uuid references public.profiles(id) on delete set null,
  from_status text,
  to_status text not null,
  notes text,
  created_at timestamptz not null default now()
);
create index idx_verif_service on public.service_verification_logs(service_id, created_at desc);

-- ───────── saved services ─────────
create table public.saved_services (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  service_id uuid not null references public.government_services(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, service_id)
);
create index idx_saved_user on public.saved_services(user_id);

-- ───────── eligibility assessments (minimal summary only) ─────────
create table public.eligibility_assessments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  service_id uuid not null references public.government_services(id) on delete cascade,
  outcome text not null check (outcome in ('likely_eligible','likely_not_eligible','insufficient_information')),
  reasons text[] not null default '{}',
  missing_facts text[] not null default '{}',
  created_at timestamptz not null default now()
);
create index idx_assess_user on public.eligibility_assessments(user_id, created_at desc);

-- ───────── checklist items ─────────
create table public.checklist_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  service_id uuid not null references public.government_services(id) on delete cascade,
  item_type text not null check (item_type in ('document','prerequisite','step','custom')),
  label text not null check (char_length(label) between 1 and 300),
  is_done boolean not null default false,
  application_reference text check (application_reference is null or char_length(application_reference) <= 64),
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_checklist_user_service on public.checklist_items(user_id, service_id);
create trigger trg_checklist_updated before update on public.checklist_items
  for each row execute function public.set_updated_at();

-- ───────── search history (anonymous-friendly, short retention) ─────────
create table public.search_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  query text not null check (char_length(query) <= 200),
  result_count int not null default 0,
  created_at timestamptz not null default now()
);
create index idx_search_created on public.search_history(created_at);
-- Retention: rows older than 90 days should be purged (see docs/SECURITY_PRIVACY.md).

-- ───────── feedback reports ─────────
create table public.feedback_reports (
  id uuid primary key default gen_random_uuid(),
  service_id uuid references public.government_services(id) on delete set null,
  user_id uuid references public.profiles(id) on delete set null,
  report_type text not null check (report_type in ('inaccurate_info','broken_link','outdated','suggestion','other')),
  message text not null check (char_length(message) between 5 and 2000),
  status text not null default 'open' check (status in ('open','reviewing','resolved','dismissed')),
  resolved_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_feedback_status on public.feedback_reports(status, created_at desc);
create trigger trg_feedback_updated before update on public.feedback_reports
  for each row execute function public.set_updated_at();

-- ───────── admin audit logs ─────────
create table public.admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id text,
  summary jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index idx_audit_created on public.admin_audit_logs(created_at desc);
