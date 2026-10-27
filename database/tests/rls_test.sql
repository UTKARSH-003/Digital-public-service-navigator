-- RLS / privilege tests. Run against a database where 001, 002 and the seed have been applied.
-- Needs Supabase-style roles (anon, authenticated) and default privileges; see database/tests/run_local.sh.
-- Everything runs in one transaction that is rolled back, so the database is left unchanged.
\set ON_ERROR_STOP on
begin;

insert into auth.users (id, email) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'a@test'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'b@test'),
  ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'editor@test'),
  ('dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'reviewer@test');
update public.profiles set role_id = 3 where id = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
update public.profiles set role_id = 4 where id = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';

insert into public.government_services (slug, name, short_description, category_id, government_level, status)
  values ('rls-draft', 'RLS draft service', 'A draft that must stay private', 1, 'central', 'draft');
insert into public.saved_services (user_id, service_id)
  select 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', id from public.government_services where slug = 'demo-farmer-income-support';
insert into public.checklist_items (user_id, service_id, item_type, label)
  select 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', id, 'custom', 'A private item' from public.government_services where slug = 'demo-farmer-income-support';
insert into public.admin_audit_logs (action, entity_type) values ('test', 'test');
insert into public.feedback_reports (report_type, message) values ('other', 'seeded report');

-- ───── anonymous visitor ─────
set local role anon;
do $$ begin
  assert (select count(*) from public.government_services) = 6, 'anon sees exactly the 6 published seed services';
  assert (select count(*) from public.government_services where slug = 'rls-draft') = 0, 'anon must not see drafts';
  assert (select count(*) from public.eligibility_rules) = 7, 'anon sees rules of published services';
  assert (select count(*) from public.service_categories) = 12, 'anon reads categories';
end $$;
do $$ declare n int; begin
  begin insert into public.government_services (slug, name, short_description, category_id, government_level) values ('anon-x', 'Anon service', 'should be denied here', 1, 'central'); raise exception 'anon insert succeeded'; exception when insufficient_privilege then null; end;
  -- table privileges exist (Supabase default) but RLS exposes zero rows
  assert (select count(*) from public.saved_services) = 0, 'anon reads no saved services';
  assert (select count(*) from public.admin_audit_logs) = 0, 'anon reads no audit logs';
  assert (select count(*) from public.checklist_items) = 0, 'anon reads no checklists';
end $$;
-- anonymous feedback is allowed, but reading it is not
insert into public.feedback_reports (report_type, message) values ('broken_link', 'anonymous report');
do $$ begin assert (select count(*) from public.feedback_reports) = 0, 'anon cannot read feedback'; end $$;
reset role;

-- ───── ordinary user A ─────
select set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', true);
set local role authenticated;
do $$ declare n int; begin
  assert (select count(*) from public.saved_services) = 1, 'A sees own saved service';
  assert (select count(*) from public.checklist_items) = 1, 'A sees own checklist';
  assert (select count(*) from public.government_services where slug = 'rls-draft') = 0, 'A must not see drafts';
  assert (select count(*) from public.admin_audit_logs) = 0, 'A cannot read audit logs';
  assert (select count(*) from public.profiles) = 1, 'A sees only own profile';
  -- cannot write catalogue
  begin insert into public.government_services (slug, name, short_description, category_id, government_level) values ('user-x', 'User service', 'should be denied here', 1, 'central'); raise exception 'user insert succeeded'; exception when insufficient_privilege then null; end;
  update public.government_services set name = 'Hacked name' where slug = 'demo-farmer-income-support';
  get diagnostics n = row_count; assert n = 0, 'user cannot update services';
  delete from public.government_services where slug = 'demo-farmer-income-support';
  get diagnostics n = row_count; assert n = 0, 'user cannot delete services';
  -- privilege escalation attempts
  begin update public.profiles set role_id = 2 where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'; raise exception 'role escalation succeeded'; exception when insufficient_privilege then null; end;
  update public.profiles set display_name = 'Alice' where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  get diagnostics n = row_count; assert n = 1, 'A can edit own display name';
  -- cannot save for someone else
  begin insert into public.saved_services (user_id, service_id) select 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', id from public.government_services limit 1; raise exception 'inserted for other user'; exception when insufficient_privilege then null; end;
  begin insert into public.admin_audit_logs (action, entity_type) values ('fake', 'fake'); raise exception 'user wrote audit log'; exception when insufficient_privilege then null; end;
end $$;
reset role;

-- ───── ordinary user B must not see A's data ─────
select set_config('request.jwt.claim.sub', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', true);
set local role authenticated;
do $$ declare n int; begin
  assert (select count(*) from public.saved_services) = 0, 'B cannot see A saved';
  assert (select count(*) from public.checklist_items) = 0, 'B cannot see A checklist';
  update public.checklist_items set is_done = true;
  get diagnostics n = row_count; assert n = 0, 'B cannot modify A checklist';
  delete from public.saved_services;
  get diagnostics n = row_count; assert n = 0, 'B cannot delete A saved';
end $$;
reset role;

-- ───── reviewer: read-only staff ─────
select set_config('request.jwt.claim.sub', 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', true);
set local role authenticated;
do $$ declare n int; begin
  assert (select count(*) from public.government_services where slug = 'rls-draft') = 1, 'reviewer sees drafts';
  assert (select count(*) from public.admin_audit_logs) = 1, 'reviewer reads audit logs';
  assert (select count(*) from public.saved_services) = 0, 'reviewer cannot read user saved services';
  update public.government_services set name = 'Reviewer edit' where slug = 'rls-draft';
  get diagnostics n = row_count; assert n = 0, 'reviewer cannot edit services';
end $$;
reset role;

-- ───── content admin ─────
select set_config('request.jwt.claim.sub', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', true);
set local role authenticated;
do $$ declare n int; begin
  update public.government_services set short_description = 'Edited by an editor.' where slug = 'rls-draft';
  get diagnostics n = row_count; assert n = 1, 'content admin can edit services';
  assert (select count(*) from public.feedback_reports) = 2, 'content admin reads feedback';
  begin update public.profiles set role_id = 2 where id = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'; raise exception 'editor escalated to super admin'; exception when insufficient_privilege then null; end;
end $$;
reset role;

-- ───── constraints ─────
do $$ begin
  begin insert into public.government_services (slug, name, short_description, category_id, government_level, application_url) values ('bad-url', 'Bad URL service', 'non-https must be rejected', 1, 'central', 'http://insecure.example'); raise exception 'http url accepted'; exception when check_violation then null; end;
  begin insert into public.government_services (slug, name, short_description, category_id, government_level) values ('state-no-code', 'State no code', 'state service needs a state', 1, 'state'); raise exception 'state without code accepted'; exception when check_violation then null; end;
  begin insert into public.government_services (slug, name, short_description, category_id, government_level, verification_status) values ('verified-no-date', 'Verified no date', 'verified needs a date', 1, 'central', 'verified'); raise exception 'verified without date accepted'; exception when check_violation then null; end;
  assert (select count(*) from public.government_services where verification_status = 'verified') = 0, 'no seed record is marked verified';
end $$;

-- ───── account deletion cascades ─────
delete from auth.users where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
do $$ begin
  assert (select count(*) from public.saved_services) = 0, 'saved services deleted with account';
  assert (select count(*) from public.checklist_items) = 0, 'checklist deleted with account';
  assert (select count(*) from public.profiles where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa') = 0, 'profile deleted with account';
end $$;

rollback;
\echo 'ALL RLS TESTS PASSED'
