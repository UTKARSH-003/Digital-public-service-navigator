import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { bearer, makeApp, USERS } from './helpers.js';

const csvHeader = 'slug,name,short_description,category_id,government_level,state_code,target_beneficiaries,tags,application_url,status\n';

async function firstService(app: ReturnType<typeof makeApp>['app'], q = '') {
  const r = await request(app).get(`/api/services?q=${q}`);
  return r.body.data[0] as { id: string; slug: string; name: string };
}

describe('public catalogue', () => {
  it('lists, paginates, searches and filters', async () => {
    const { app } = makeApp();
    const all = await request(app).get('/api/services?pageSize=2');
    expect(all.status).toBe(200);
    expect(all.body.data).toHaveLength(2);
    expect(all.body.meta.total).toBe(6);
    expect((await request(app).get('/api/services?q=scholarship')).body.data[0].slug).toBe('demo-post-matric-scholarship');
    expect((await request(app).get('/api/services?category=agriculture')).body.meta.total).toBe(1);
    expect((await request(app).get('/api/services?q=zzzzqq')).body.meta.total).toBe(0);
  });
  it('rejects invalid query params and bad ids', async () => {
    const { app } = makeApp();
    expect((await request(app).get('/api/services?pageSize=500')).status).toBe(400);
    expect((await request(app).get('/api/services?state=xx')).status).toBe(400);
    expect((await request(app).get('/api/services/does-not-exist')).status).toBe(404);
  });
  it('does not break on injection-style search strings', async () => {
    const { app } = makeApp();
    const r = await request(app).get(`/api/services?q=${encodeURIComponent("'; drop table government_services;--")}`);
    expect(r.status).toBe(200);
  });
  it('never exposes draft services publicly', async () => {
    const { app, repo } = makeApp();
    const created = await repo.createService(
      { slug: 'secret-draft', name: 'Secret draft', short_description: 'not published yet', category_id: 1, government_level: 'central', target_beneficiaries: [], fees_verified: false, dates_verified: false, tags: [], status: 'draft' },
      USERS['tok-editor']!.id,
    );
    expect((await request(app).get(`/api/services/${created.id}`)).status).toBe(404);
    expect((await request(app).get('/api/services?q=secret')).body.meta.total).toBe(0);
  });
  it('seed records are never marked verified', async () => {
    const { app } = makeApp();
    const r = await request(app).get('/api/services?pageSize=50');
    expect(r.body.data.every((s: { verification_status: string }) => s.verification_status === 'demonstration')).toBe(true);
  });
});

describe('eligibility endpoint', () => {
  it('returns outcome, sources and documents', async () => {
    const { app } = makeApp();
    const s = await firstService(app, 'scholarship');
    const r = await request(app).post('/api/eligibility/evaluate').send({ service_id: s.id, answers: { occupation: 'student', annual_income: 100000 } });
    expect(r.status).toBe(200);
    expect(r.body.data.outcome).toBe('likely_eligible');
    expect(r.body.data.official_sources[0].url).toMatch(/^https:\/\//);
    expect(r.body.data.saved).toBe(false);
  });
  it('rejects malformed answers and unknown fields', async () => {
    const { app } = makeApp();
    const s = await firstService(app);
    expect((await request(app).post('/api/eligibility/evaluate').send({ service_id: s.id, answers: { age: -3 } })).status).toBe(400);
    expect((await request(app).post('/api/eligibility/evaluate').send({ service_id: s.id, answers: { aadhaar: '123' } })).status).toBe(400);
    expect((await request(app).post('/api/eligibility/evaluate').send({ service_id: 'nope', answers: {} })).status).toBe(400);
  });
  it('stores only the summary, never the answers', async () => {
    const { app, repo } = makeApp();
    const s = await firstService(app, 'scholarship');
    await request(app).post('/api/eligibility/evaluate').set(bearer('tok-user')).send({ service_id: s.id, answers: { annual_income: 123456, occupation: 'student' }, save: true });
    expect(repo.assessments).toHaveLength(1);
    expect(JSON.stringify(repo.assessments[0])).not.toContain('123456');
  });
});

describe('assistant', () => {
  it('works with no AI configured and cites official sources', async () => {
    const { app, env } = makeApp();
    expect(env.aiConfigured).toBe(false);
    const r = await request(app).post('/api/assistant/query').send({ message: 'Which scholarships can I apply for?' });
    expect(r.status).toBe(200);
    expect(r.body.data.mode).toBe('fallback');
    expect(r.body.data.citations[0].url).toMatch(/^https:\/\//);
    expect(r.body.data.verified).toBe(false);
  });
  it('says information is not verified when nothing matches', async () => {
    const { app } = makeApp();
    const r = await request(app).post('/api/assistant/query').send({ message: 'quantum teleportation subsidy' });
    expect(r.body.data.answer).toMatch(/Information not verified/);
    expect(r.body.data.clarifying_question).toBeTruthy();
  });
  it('refuses to take OTPs or passwords', async () => {
    const { app } = makeApp();
    const r = await request(app).post('/api/assistant/query').send({ message: 'my OTP is 123456, apply for me' });
    expect(r.body.data.intent).toBe('sensitive_data_warning');
    expect(r.body.data.services).toEqual([]);
  });
  it('falls back gracefully when the AI provider fails', async () => {
    const { app, env } = makeApp({ AI_PROVIDER: 'openai', AI_API_KEY: 'x', AI_MODEL: 'm', AI_TIMEOUT_MS: '200' });
    expect(env.aiConfigured).toBe(true);
    const realFetch = globalThis.fetch;
    globalThis.fetch = (() => Promise.reject(new Error('network down'))) as typeof fetch;
    try {
      const r = await request(app).post('/api/assistant/query').send({ message: 'documents for pension' });
      expect(r.status).toBe(200);
      expect(r.body.data.mode).toBe('fallback');
      expect(r.body.data.answer).toMatch(/Age proof/);
    } finally {
      globalThis.fetch = realFetch;
    }
  });
  it('validates input', async () => {
    const { app } = makeApp();
    expect((await request(app).post('/api/assistant/query').send({ message: '' })).status).toBe(400);
  });
});

describe('authentication and user data isolation', () => {
  it('rejects anonymous and invalid tokens on user routes', async () => {
    const { app } = makeApp();
    expect((await request(app).get('/api/user/saved-services')).status).toBe(401);
    expect((await request(app).get('/api/user/saved-services').set(bearer('bad'))).status).toBe(401);
    expect((await request(app).get('/api/recommendations')).status).toBe(401);
  });
  it('saves, lists and deletes; users cannot touch each other’s data', async () => {
    const { app } = makeApp();
    const s = await firstService(app);
    const saved = await request(app).post('/api/user/saved-services').set(bearer('tok-user')).send({ service_id: s.id });
    expect(saved.status).toBe(201);
    expect((await request(app).get('/api/user/saved-services').set(bearer('tok-user'))).body.data).toHaveLength(1);
    expect((await request(app).get('/api/user/saved-services').set(bearer('tok-user2'))).body.data).toHaveLength(0);
    expect((await request(app).delete(`/api/user/saved-services/${saved.body.data.id}`).set(bearer('tok-user2'))).status).toBe(404);
    expect((await request(app).delete(`/api/user/saved-services/${saved.body.data.id}`).set(bearer('tok-user'))).status).toBe(204);
  });
  it('creates a checklist once and lets only the owner edit it', async () => {
    const { app } = makeApp();
    const s = await firstService(app, 'scholarship');
    const c1 = await request(app).post('/api/user/checklists').set(bearer('tok-user')).send({ service_id: s.id, custom_items: ['Photocopy certificates'] });
    expect(c1.status).toBe(201);
    expect(c1.body.data.some((i: { item_type: string }) => i.item_type === 'custom')).toBe(true);
    const c2 = await request(app).post('/api/user/checklists').set(bearer('tok-user')).send({ service_id: s.id });
    expect(c2.body.data).toHaveLength(c1.body.data.length);
    const id = c1.body.data[0].id;
    expect((await request(app).patch(`/api/user/checklists/${id}`).set(bearer('tok-user2')).send({ is_done: true })).status).toBe(404);
    const ok = await request(app).patch(`/api/user/checklists/${id}`).set(bearer('tok-user')).send({ is_done: true, application_reference: 'REF-2026/001' });
    expect(ok.body.data.is_done).toBe(true);
    expect((await request(app).patch(`/api/user/checklists/${id}`).set(bearer('tok-user')).send({ application_reference: '<script>' })).status).toBe(400);
    expect((await request(app).patch(`/api/user/checklists/${id}`).set(bearer('tok-user')).send({})).status).toBe(400);
  });
  it('appends custom checklist items to an existing checklist without duplicating the rest', async () => {
    const { app } = makeApp();
    const s = await firstService(app, 'scholarship');
    const c1 = await request(app).post('/api/user/checklists').set(bearer('tok-user')).send({ service_id: s.id });
    const c2 = await request(app).post('/api/user/checklists').set(bearer('tok-user')).send({ service_id: s.id, custom_items: ['Ask school for bonafide'] });
    expect(c2.body.data).toHaveLength(c1.body.data.length + 1);
    expect(c2.body.data.at(-1).item_type).toBe('custom');
  });
  it('/api/me returns the caller role and requires auth', async () => {
    const { app } = makeApp();
    expect((await request(app).get('/api/me')).status).toBe(401);
    expect((await request(app).get('/api/me').set(bearer('tok-reviewer'))).body.data.role).toBe('reviewer');
  });
  it('exports and deletes account data', async () => {
    const { app, repo } = makeApp();
    const s = await firstService(app);
    await request(app).post('/api/user/saved-services').set(bearer('tok-user')).send({ service_id: s.id });
    const exp = await request(app).get('/api/user/export').set(bearer('tok-user'));
    expect(exp.body.data.saved_services).toHaveLength(1);
    expect((await request(app).delete('/api/user/account').set(bearer('tok-user'))).status).toBe(204);
    expect(repo.saved).toHaveLength(0);
    expect(repo.deletedUsers.has(USERS['tok-user']!.id)).toBe(true);
  });
  it('ignores personalisation without consent', async () => {
    const { app } = makeApp();
    await request(app).put('/api/user/preferences').set(bearer('tok-user')).send({ profiling_consent: false, occupation: 'farmer', state_code: 'UP' });
    const prefs = await request(app).get('/api/user/preferences').set(bearer('tok-user'));
    expect(prefs.body.data.occupation).toBeNull();
    const recs = await request(app).get('/api/recommendations').set(bearer('tok-user'));
    expect(recs.body.meta.personalised).toBe(false);
  });
  it('recommends with explained reasons after consent', async () => {
    const { app } = makeApp();
    await request(app).put('/api/user/preferences').set(bearer('tok-user')).send({ profiling_consent: true, occupation: 'farmer' });
    const recs = await request(app).get('/api/recommendations').set(bearer('tok-user'));
    expect(recs.body.data[0].service.slug).toBe('demo-farmer-income-support');
    expect(recs.body.data[0].reasons.length).toBeGreaterThan(0);
  });
});

describe('admin authorization', () => {
  const payload = { slug: 'new-service', name: 'New service', short_description: 'A brand new service description', category_id: 1, government_level: 'central' };

  it('blocks anonymous and ordinary users on every admin route', async () => {
    const { app } = makeApp();
    for (const [method, path] of [['get', '/api/admin/services'], ['post', '/api/admin/services'], ['get', '/api/admin/audit-logs'], ['get', '/api/admin/analytics'], ['post', '/api/admin/services/import'], ['get', '/api/admin/verification-queue']] as const) {
      expect((await request(app)[method](path)).status).toBe(401);
      expect((await request(app)[method](path).set(bearer('tok-user'))).status).toBe(403);
    }
  });
  it('reviewers are read-only', async () => {
    const { app } = makeApp();
    expect((await request(app).get('/api/admin/services').set(bearer('tok-reviewer'))).status).toBe(200);
    expect((await request(app).post('/api/admin/services').set(bearer('tok-reviewer')).send(payload)).status).toBe(403);
    const s = await firstService(app);
    expect((await request(app).patch(`/api/admin/services/${s.id}`).set(bearer('tok-reviewer')).send({ name: 'Hacked name' })).status).toBe(403);
    expect((await request(app).post(`/api/admin/services/${s.id}/verify`).set(bearer('tok-reviewer')).send({ to_status: 'verified' })).status).toBe(403);
  });
  it('editors create and edit, new content is awaiting verification, and actions are audited', async () => {
    const { app, repo } = makeApp();
    const c = await request(app).post('/api/admin/services').set(bearer('tok-editor')).send(payload);
    expect(c.status).toBe(201);
    expect(c.body.data.verification_status).toBe('awaiting_verification');
    const p = await request(app).patch(`/api/admin/services/${c.body.data.id}`).set(bearer('tok-editor')).send({ name: 'Renamed service', status: 'published' });
    expect(p.body.data.name).toBe('Renamed service');
    expect(repo.audit.map((a) => a.action)).toEqual(['service.create', 'service.update']);
    expect((await request(app).post('/api/admin/services').set(bearer('tok-editor')).send(payload)).status).toBe(409);
  });
  it('rejects non-https URLs and invalid payloads', async () => {
    const { app } = makeApp();
    expect((await request(app).post('/api/admin/services').set(bearer('tok-editor')).send({ ...payload, application_url: 'http://example.gov.in' })).status).toBe(400);
    expect((await request(app).post('/api/admin/services').set(bearer('tok-editor')).send({ ...payload, application_url: 'javascript:alert(1)' })).status).toBe(400);
    expect((await request(app).post('/api/admin/services').set(bearer('tok-editor')).send({ ...payload, government_level: 'planet' })).status).toBe(400);
  });
  it('requires an official source before verification, and records the reviewer', async () => {
    const { app } = makeApp();
    const c = await request(app).post('/api/admin/services').set(bearer('tok-editor')).send(payload);
    expect((await request(app).post(`/api/admin/services/${c.body.data.id}/verify`).set(bearer('tok-editor')).send({ to_status: 'verified' })).status).toBe(400);
    await request(app).patch(`/api/admin/services/${c.body.data.id}`).set(bearer('tok-editor')).send({ sources: [{ title: 'Portal', url: 'https://www.india.gov.in/', is_primary: true }] });
    const v = await request(app).post(`/api/admin/services/${c.body.data.id}/verify`).set(bearer('tok-editor')).send({ to_status: 'verified' });
    expect(v.status).toBe(200);
    expect(v.body.data.verified_by).toBe(USERS['tok-editor']!.id);
    expect(v.body.data.last_verified_at).toBeTruthy();
  });
  it('only super admins can delete services or change roles, and not their own role', async () => {
    const { app } = makeApp();
    const s = await firstService(app);
    expect((await request(app).delete(`/api/admin/services/${s.id}`).set(bearer('tok-editor'))).status).toBe(403);
    const target = USERS['tok-user']!.id;
    expect((await request(app).patch(`/api/admin/users/${target}/role`).set(bearer('tok-editor')).send({ role: 'super_admin' })).status).toBe(403);
    expect((await request(app).patch(`/api/admin/users/${target}/role`).set(bearer('tok-user')).send({ role: 'super_admin' })).status).toBe(403);
    expect((await request(app).patch(`/api/admin/users/${USERS['tok-super']!.id}/role`).set(bearer('tok-super')).send({ role: 'user' })).status).toBe(400);
    expect((await request(app).patch(`/api/admin/users/${target}/role`).set(bearer('tok-super')).send({ role: 'reviewer' })).status).toBe(200);
    expect((await request(app).delete(`/api/admin/services/${s.id}`).set(bearer('tok-super'))).status).toBe(204);
  });
  it('analytics contain no user identifiers', async () => {
    const { app } = makeApp();
    await request(app).get('/api/services?q=pension').set(bearer('tok-user'));
    const r = await request(app).get('/api/admin/analytics').set(bearer('tok-reviewer'));
    expect(r.status).toBe(200);
    expect(JSON.stringify(r.body)).not.toContain(USERS['tok-user']!.id);
  });
});

describe('CSV import / export', () => {
  const csvPost = (app: ReturnType<typeof makeApp>['app'], body: string, token = 'tok-editor', qs = '') =>
    request(app).post(`/api/admin/services/import${qs}`).set(bearer(token)).set('Content-Type', 'text/csv').send(body);

  it('imports valid rows as drafts awaiting verification', async () => {
    const { app, repo } = makeApp();
    const r = await csvPost(app, `${csvHeader}csv-one,CSV one,A valid description here,1,central,,students|youth,a|b,https://www.india.gov.in/,published\n`);
    expect(r.status).toBe(201);
    const svc = [...repo.services.values()].find((s) => s.slug === 'csv-one')!;
    expect(svc.status).toBe('draft');
    expect(svc.verification_status).toBe('awaiting_verification');
  });
  it('is all-or-nothing and reports row errors (bad URL, bad level, duplicate slug)', async () => {
    const { app, repo } = makeApp();
    const before = repo.services.size;
    const r = await csvPost(app, `${csvHeader}ok-row,Fine name,A valid description here,1,central,,,,,draft\nbad-url,Bad url,A valid description here,1,central,,,,http://insecure.example,draft\nstate-no-code,State svc,A valid description here,1,state,,,,,draft\nok-row,Dup,A valid description here,1,central,,,,,draft\n`);
    expect(r.status).toBe(422);
    expect(r.body.error.details.map((d: { row: number }) => d.row)).toEqual([3, 4, 5]);
    expect(repo.services.size).toBe(before);
  });
  it('supports dry runs and blocks non-editors', async () => {
    const { app, repo } = makeApp();
    const before = repo.services.size;
    const row = `${csvHeader}dry-one,Dry one,A valid description here,1,central,,,,,draft\n`;
    expect((await csvPost(app, row, 'tok-editor', '?dry_run=true')).body.data).toEqual({ valid_rows: 1, imported: 0 });
    expect(repo.services.size).toBe(before);
    expect((await csvPost(app, row, 'tok-reviewer')).status).toBe(403);
    expect((await csvPost(app, row, 'tok-user')).status).toBe(403);
  });
  it('neutralises spreadsheet formulas on export', async () => {
    const { app, repo } = makeApp();
    await repo.createService({ slug: 'formula-test', name: '=HYPERLINK("http://evil")', short_description: 'formula injection test', category_id: 1, government_level: 'central', target_beneficiaries: [], fees_verified: false, dates_verified: false, tags: [], status: 'draft' }, USERS['tok-editor']!.id);
    const r = await request(app).get('/api/admin/services/export').set(bearer('tok-reviewer'));
    expect(r.status).toBe(200);
    expect(r.text).toContain(`'=HYPERLINK`);
    expect(r.text).not.toMatch(/(^|,)"?=HYPERLINK/m);
  });
});

describe('platform hardening', () => {
  it('returns JSON errors without stack traces', async () => {
    const { app } = makeApp();
    const r = await request(app).post('/api/feedback').set('Content-Type', 'application/json').send('{bad json');
    expect(r.status).toBe(400);
    expect(r.body.error.code).toBe('bad_json');
    expect(JSON.stringify(r.body)).not.toMatch(/at .*\.ts/);
    expect((await request(app).get('/nope')).status).toBe(404);
  });
  it('sets security headers and honours the CORS allowlist', async () => {
    const { app } = makeApp({ CORS_ORIGINS: 'https://good.example' });
    const ok = await request(app).get('/health').set('Origin', 'https://good.example');
    expect(ok.headers['access-control-allow-origin']).toBe('https://good.example');
    expect(ok.headers['x-content-type-options']).toBe('nosniff');
    expect(ok.headers['x-powered-by']).toBeUndefined();
    const bad = await request(app).get('/health').set('Origin', 'https://evil.example');
    expect(bad.headers['access-control-allow-origin']).toBeUndefined();
  });
  it('accepts feedback anonymously and validates it', async () => {
    const { app } = makeApp();
    expect((await request(app).post('/api/feedback').send({ report_type: 'broken_link', message: 'The link does not open' })).status).toBe(201);
    expect((await request(app).post('/api/feedback').send({ report_type: 'broken_link', message: 'x' })).status).toBe(400);
  });
});
