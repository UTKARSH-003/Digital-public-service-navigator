-- Row Level Security policies
-- The Express backend uses the service-role key (bypasses RLS) and enforces roles in code.
-- These policies are the second layer: they protect direct access via the anon/authenticated keys.

-- Helper: current user's role name (security definer avoids recursive RLS on profiles)
create or replace function public.current_role_name() returns text
language sql stable security definer set search_path = public as $$
  select r.name from public.profiles p join public.roles r on r.id = p.role_id where p.id = auth.uid()
$$;

create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.current_role_name() in ('super_admin','content_admin','reviewer'), false)
$$;

create or replace function public.can_edit_content() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.current_role_name() in ('super_admin','content_admin'), false)
$$;

create or replace function public.is_super_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.current_role_name() = 'super_admin', false)
$$;

-- Enable RLS everywhere
alter table public.roles enable row level security;
alter table public.profiles enable row level security;
alter table public.user_preferences enable row level security;
alter table public.service_categories enable row level security;
alter table public.government_services enable row level security;
alter table public.service_translations enable row level security;
alter table public.eligibility_rules enable row level security;
alter table public.required_documents enable row level security;
alter table public.application_steps enable row level security;
alter table public.official_sources enable row level security;
alter table public.service_verification_logs enable row level security;
alter table public.saved_services enable row level security;
alter table public.eligibility_assessments enable row level security;
alter table public.checklist_items enable row level security;
alter table public.search_history enable row level security;
alter table public.feedback_reports enable row level security;
alter table public.admin_audit_logs enable row level security;

-- roles: readable by everyone signed in; only super admin writes
create policy roles_read on public.roles for select to authenticated using (true);
create policy roles_write on public.roles for all to authenticated
  using (public.is_super_admin()) with check (public.is_super_admin());

-- profiles: own row; staff can read all. role_id is NOT user-writable (column grant below).
create policy profiles_select_own on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_staff());
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
create policy profiles_update_super on public.profiles for update to authenticated
  using (public.is_super_admin()) with check (public.is_super_admin());

-- Prevent privilege escalation: authenticated users may only update harmless columns.
revoke update on public.profiles from authenticated;
grant update (display_name, preferred_language) on public.profiles to authenticated;
-- Role changes happen only through the backend (service role) after a super_admin check.

-- user_preferences
create policy prefs_own on public.user_preferences for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- public catalogue: anyone may read published content
create policy categories_read on public.service_categories for select to anon, authenticated using (true);
create policy categories_write on public.service_categories for all to authenticated
  using (public.can_edit_content()) with check (public.can_edit_content());

create policy services_read_published on public.government_services for select to anon, authenticated
  using (status = 'published' or public.is_staff());
create policy services_write on public.government_services for all to authenticated
  using (public.can_edit_content()) with check (public.can_edit_content());

-- child tables: visible when parent is published (or staff); writable by content editors
create policy translations_read on public.service_translations for select to anon, authenticated
  using (public.is_staff() or exists (select 1 from public.government_services s where s.id = service_id and s.status = 'published'));
create policy translations_write on public.service_translations for all to authenticated
  using (public.can_edit_content()) with check (public.can_edit_content());

create policy rules_read on public.eligibility_rules for select to anon, authenticated
  using (public.is_staff() or exists (select 1 from public.government_services s where s.id = service_id and s.status = 'published'));
create policy rules_write on public.eligibility_rules for all to authenticated
  using (public.can_edit_content()) with check (public.can_edit_content());

create policy docs_read on public.required_documents for select to anon, authenticated
  using (public.is_staff() or exists (select 1 from public.government_services s where s.id = service_id and s.status = 'published'));
create policy docs_write on public.required_documents for all to authenticated
  using (public.can_edit_content()) with check (public.can_edit_content());

create policy steps_read on public.application_steps for select to anon, authenticated
  using (public.is_staff() or exists (select 1 from public.government_services s where s.id = service_id and s.status = 'published'));
create policy steps_write on public.application_steps for all to authenticated
  using (public.can_edit_content()) with check (public.can_edit_content());

create policy sources_read on public.official_sources for select to anon, authenticated
  using (public.is_staff() or exists (select 1 from public.government_services s where s.id = service_id and s.status = 'published'));
create policy sources_write on public.official_sources for all to authenticated
  using (public.can_edit_content()) with check (public.can_edit_content());

-- verification logs: staff only
create policy verif_read on public.service_verification_logs for select to authenticated using (public.is_staff());
create policy verif_insert on public.service_verification_logs for insert to authenticated
  with check (public.can_edit_content());

-- user-owned data: strict isolation
create policy saved_own on public.saved_services for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy assess_own on public.eligibility_assessments for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy checklist_own on public.checklist_items for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- search history: users see only their own; staff see none directly (analytics are aggregated by backend)
create policy search_own_read on public.search_history for select to authenticated using (user_id = auth.uid());
create policy search_insert on public.search_history for insert to anon, authenticated
  with check (user_id is null or user_id = auth.uid());

-- feedback: anyone may submit; submitter reads own; staff read/update all
create policy feedback_insert on public.feedback_reports for insert to anon, authenticated
  with check (user_id is null or user_id = auth.uid());
create policy feedback_read on public.feedback_reports for select to authenticated
  using (user_id = auth.uid() or public.is_staff());
create policy feedback_update on public.feedback_reports for update to authenticated
  using (public.can_edit_content()) with check (public.can_edit_content());

-- audit logs: staff read; inserts only through backend (service role). No update/delete policies = immutable.
create policy audit_read on public.admin_audit_logs for select to authenticated using (public.is_staff());
