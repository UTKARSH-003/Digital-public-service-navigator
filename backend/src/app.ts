import express, { type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import swaggerUi from 'swagger-ui-express';
import type { Env } from './config/env.js';
import { openapi } from './config/openapi.js';
import type { AuthVerifier, Repo } from './repositories/types.js';
import { EDITORS, optionalAuth, requireAuth, requireRole, STAFF } from './middleware/auth.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { badRequest, notFound } from './utils/errors.js';
import {
  answersSchema, assistantBody, createChecklistBody, evaluateBody, feedbackBody, feedbackPatchBody,
  listServicesQuery, patchChecklistBody, preferencesBody, roleChangeBody, saveServiceBody,
  serviceWriteBody, servicePatchBody, uuidParam, verifyBody,
} from './validators/schemas.js';
import { buildQuestions, evaluateEligibility } from './services/eligibility.js';
import { recommend } from './services/recommendations.js';
import { answerQuery } from './services/assistant.js';
import { MAX_CSV_BYTES, parseServicesCsv, servicesToCsv } from './services/csv.js';
import { z } from 'zod';

const wrap =
  (fn: (req: Request, res: Response) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) => {
    fn(req, res).catch(next);
  };

export function createApp(env: Env, repo: Repo, verifier: AuthVerifier) {
  const app = express();
  app.set('trust proxy', 1);
  app.disable('x-powered-by');
  // API returns JSON only, so a locked-down CSP is safe (docs route relaxes it below).
  app.use(helmet({ contentSecurityPolicy: { directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] } } }));
  app.use(
    cors({
      origin(origin, cb) {
        if (!origin || env.corsOrigins.includes(origin)) return cb(null, true);
        cb(null, false);
      },
      credentials: false,
      methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    }),
  );
  app.use(express.json({ limit: '100kb' }));
  app.use(
    rateLimit({ windowMs: env.RATE_LIMIT_WINDOW_MS, limit: env.RATE_LIMIT_MAX, standardHeaders: true, legacyHeaders: false }),
  );
  const strict = rateLimit({ windowMs: 60_000, limit: 10, standardHeaders: true, legacyHeaders: false });
  const aiDaily = new Map<string, { day: string; n: number }>();
  const aiAllowed = (ip: string) => {
    const day = new Date().toISOString().slice(0, 10);
    const cur = aiDaily.get(ip);
    if (!cur || cur.day !== day) {
      aiDaily.set(ip, { day, n: 1 });
      return true;
    }
    if (cur.n >= env.AI_DAILY_LIMIT_PER_IP) return false;
    cur.n++;
    return true;
  };

  const auth = optionalAuth(verifier);
  const mustAuth = requireAuth(verifier);

  // ── health & docs ──
  app.get('/health', (_req, res) =>
    res.json({ status: 'ok', supabase: env.supabaseConfigured, ai: env.aiConfigured, time: new Date().toISOString() }),
  );
  app.get('/api/openapi.json', (_req, res) => res.json(openapi));
  app.use('/api/docs', helmet({ contentSecurityPolicy: false }), swaggerUi.serve, swaggerUi.setup(openapi));

  // ── public catalogue ──
  app.get('/api/categories', wrap(async (_req, res) => {
    res.json({ data: await repo.listCategories() });
  }));

  app.get('/api/services', auth, wrap(async (req, res) => {
    const q = listServicesQuery.parse(req.query);
    const result = await repo.listServices(q, { includeUnpublished: false });
    if (q.q && q.page === 1) void repo.recordSearch(q.q, result.total, req.user?.id).catch(() => undefined);
    res.json({ data: result.items, meta: { page: q.page, pageSize: q.pageSize, total: result.total } });
  }));

  app.get('/api/services/:id', auth, wrap(async (req, res) => {
    const s = await repo.getService(String(req.params.id), { includeUnpublished: false });
    if (!s) throw notFound('Service not found');
    res.json({ data: { ...s, eligibility_questions: buildQuestions(s.rules) } });
  }));

  // ── eligibility ──
  app.post('/api/eligibility/evaluate', auth, wrap(async (req, res) => {
    const body = evaluateBody.parse(req.body);
    const s = await repo.getService(body.service_id, { includeUnpublished: false });
    if (!s) throw notFound('Service not found');
    const result = evaluateEligibility(s.rules, body.answers);
    let saved = false;
    if (body.save && req.user) {
      // Only the outcome summary is stored, never the answers.
      await repo.saveAssessment(req.user.id, s.id, result.outcome, result.reasons, result.missing_facts);
      saved = true;
    }
    res.json({
      data: {
        ...result,
        saved,
        service: { id: s.id, name: s.name, verification_status: s.verification_status },
        official_sources: s.sources.map((x) => ({ title: x.title, url: x.url })),
        documents: s.documents,
        steps: s.steps,
      },
    });
  }));

  // ── assistant ──
  app.post('/api/assistant/query', strict, auth, wrap(async (req, res) => {
    const body = assistantBody.parse(req.body);
    const services = await repo.listPublishedDetails();
    const reply = await answerQuery(env, services, body.message, {
      language: body.language, state: body.state, aiAllowed: env.aiConfigured && aiAllowed(req.ip ?? 'unknown'),
    });
    res.json({ data: reply });
  }));

  // ── feedback ──
  app.post('/api/feedback', strict, auth, wrap(async (req, res) => {
    const body = feedbackBody.parse(req.body);
    const r = await repo.createFeedback({ ...body, user_id: req.user?.id });
    res.status(201).json({ data: r });
  }));

  // ── authenticated user ──
  app.get('/api/recommendations', mustAuth, wrap(async (req, res) => {
    const uid = req.user!.id;
    const [prefs, services, saved] = await Promise.all([repo.getPreferences(uid), repo.listPublishedDetails(), repo.listSaved(uid)]);
    const recs = recommend(services, prefs, { savedCategoryIds: saved.map((s) => s.service.category_id) });
    res.json({ data: recs, meta: { personalised: Boolean(prefs?.profiling_consent) } });
  }));

  // Lets the UI show/hide navigation. It is not authorization: admin routes enforce roles themselves.
  app.get('/api/me', mustAuth, wrap(async (req, res) => {
    res.json({ data: { id: req.user!.id, role: req.user!.role } });
  }));

  app.get('/api/user/preferences', mustAuth, wrap(async (req, res) => {
    res.json({ data: await repo.getPreferences(req.user!.id) });
  }));
  app.put('/api/user/preferences', mustAuth, wrap(async (req, res) => {
    const body = preferencesBody.parse(req.body);
    res.json({ data: await repo.upsertPreferences(req.user!.id, body) });
  }));

  app.get('/api/user/saved-services', mustAuth, wrap(async (req, res) => {
    res.json({ data: await repo.listSaved(req.user!.id) });
  }));
  app.post('/api/user/saved-services', mustAuth, wrap(async (req, res) => {
    const { service_id } = saveServiceBody.parse(req.body);
    if (!(await repo.getService(service_id, { includeUnpublished: false }))) throw notFound('Service not found');
    res.status(201).json({ data: await repo.saveService(req.user!.id, service_id) });
  }));
  app.delete('/api/user/saved-services/:id', mustAuth, wrap(async (req, res) => {
    const { id } = uuidParam.parse(req.params);
    if (!(await repo.unsaveService(req.user!.id, id))) throw notFound();
    res.status(204).end();
  }));

  app.get('/api/user/checklists', mustAuth, wrap(async (req, res) => {
    const sid = typeof req.query.service_id === 'string' ? z.string().uuid().parse(req.query.service_id) : undefined;
    res.json({ data: await repo.listChecklist(req.user!.id, sid) });
  }));
  app.post('/api/user/checklists', mustAuth, wrap(async (req, res) => {
    const body = createChecklistBody.parse(req.body);
    if (!(await repo.getService(body.service_id, { includeUnpublished: false }))) throw notFound('Service not found');
    res.status(201).json({
      data: await repo.createChecklist(req.user!.id, body.service_id, body.custom_items ?? []),
      meta: { note: 'Checklist progress is maintained by you; it is not linked to any government application status.' },
    });
  }));
  app.patch('/api/user/checklists/:id', mustAuth, wrap(async (req, res) => {
    const { id } = uuidParam.parse(req.params);
    const patch = patchChecklistBody.parse(req.body);
    const item = await repo.patchChecklistItem(req.user!.id, id, patch);
    if (!item) throw notFound();
    res.json({ data: item });
  }));

  app.get('/api/user/assessments', mustAuth, wrap(async (req, res) => {
    res.json({ data: await repo.listAssessments(req.user!.id) });
  }));
  app.get('/api/user/export', mustAuth, wrap(async (req, res) => {
    res.json({ data: await repo.exportUserData(req.user!.id) });
  }));
  app.delete('/api/user/account', mustAuth, wrap(async (req, res) => {
    await repo.deleteUserData(req.user!.id);
    res.status(204).end();
  }));

  // ── admin (role enforced here; RLS is a second layer) ──
  const admin = express.Router();
  admin.use(mustAuth, requireRole(...STAFF));

  admin.get('/services', wrap(async (req, res) => {
    const q = listServicesQuery.parse(req.query);
    const r = await repo.listServices(q, { includeUnpublished: true });
    res.json({ data: r.items, meta: { page: q.page, pageSize: q.pageSize, total: r.total } });
  }));
  admin.get('/services/export', wrap(async (_req, res) => {
    res.type('text/csv').attachment('services.csv').send(servicesToCsv(await repo.exportAllServices()));
  }));
  admin.get('/services/:id', wrap(async (req, res) => {
    const s = await repo.getService(String(req.params.id), { includeUnpublished: true });
    if (!s) throw notFound();
    res.json({ data: s });
  }));
  admin.post('/services', requireRole(...EDITORS), wrap(async (req, res) => {
    const body = serviceWriteBody.parse(req.body);
    const s = await repo.createService(body, req.user!.id);
    await repo.writeAudit(req.user!.id, 'service.create', 'service', s.id, { slug: s.slug });
    res.status(201).json({ data: s });
  }));
  admin.patch('/services/:id', requireRole(...EDITORS), wrap(async (req, res) => {
    const { id } = uuidParam.parse(req.params);
    const patch = servicePatchBody.parse(req.body);
    const s = await repo.updateService(id, patch, req.user!.id);
    if (!s) throw notFound();
    await repo.writeAudit(req.user!.id, 'service.update', 'service', id, { fields: Object.keys(patch) });
    res.json({ data: s });
  }));
  admin.delete('/services/:id', requireRole('super_admin'), wrap(async (req, res) => {
    const { id } = uuidParam.parse(req.params);
    if (!(await repo.deleteService(id))) throw notFound();
    await repo.writeAudit(req.user!.id, 'service.delete', 'service', id);
    res.status(204).end();
  }));
  admin.post('/services/import', requireRole(...EDITORS), express.text({ type: ['text/csv', 'text/plain'], limit: MAX_CSV_BYTES }), wrap(async (req, res) => {
    if (typeof req.body !== 'string' || !req.body.trim()) throw badRequest('Send CSV text with Content-Type: text/csv');
    const dryRun = req.query.dry_run === 'true';
    let parsed;
    try {
      parsed = parseServicesCsv(req.body);
    } catch (e) {
      throw badRequest(e instanceof Error ? e.message : 'Invalid CSV');
    }
    // All-or-nothing: if any row is invalid nothing is imported.
    if (parsed.errors.length) return res.status(422).json({ error: { code: 'invalid_csv', message: 'Some rows are invalid; nothing was imported', details: parsed.errors } });
    if (dryRun) return res.json({ data: { valid_rows: parsed.rows.length, imported: 0 } });
    let imported = 0;
    for (const row of parsed.rows) {
      // Imported content is always created as draft and awaiting verification.
      await repo.createService({ ...row, status: 'draft' }, req.user!.id);
      imported++;
    }
    await repo.writeAudit(req.user!.id, 'service.import', 'service', null, { imported });
    res.status(201).json({ data: { imported } });
  }));
  admin.get('/verification-queue', wrap(async (_req, res) => {
    res.json({ data: await repo.verificationQueue() });
  }));
  admin.post('/services/:id/verify', requireRole(...EDITORS), wrap(async (req, res) => {
    const { id } = uuidParam.parse(req.params);
    const body = verifyBody.parse(req.body);
    if (body.to_status === 'verified') {
      const s = await repo.getService(id, { includeUnpublished: true });
      if (!s) throw notFound();
      if (!s.sources.length) throw badRequest('Add at least one official source before marking a service as verified');
    }
    const r = await repo.setVerification(id, body.to_status, req.user!.id, body.notes, body.next_review_days);
    if (!r) throw notFound();
    await repo.writeAudit(req.user!.id, 'service.verify', 'service', id, { to: body.to_status });
    res.json({ data: r });
  }));
  admin.get('/feedback', wrap(async (req, res) => {
    const status = typeof req.query.status === 'string' ? req.query.status : undefined;
    res.json({ data: await repo.listFeedback(status) });
  }));
  admin.patch('/feedback/:id', requireRole(...EDITORS), wrap(async (req, res) => {
    const { id } = uuidParam.parse(req.params);
    const { status } = feedbackPatchBody.parse(req.body);
    if (!(await repo.updateFeedbackStatus(id, status, req.user!.id))) throw notFound();
    await repo.writeAudit(req.user!.id, 'feedback.update', 'feedback', id, { status });
    res.json({ data: { id, status } });
  }));
  admin.get('/analytics', wrap(async (_req, res) => {
    // Aggregates only: no user identifiers.
    res.json({ data: { ...(await repo.analyticsCounts()), search: await repo.searchStats() } });
  }));
  admin.get('/audit-logs', wrap(async (req, res) => {
    const limit = Math.min(Number(req.query.limit) || 100, 500);
    res.json({ data: await repo.listAudit(limit) });
  }));
  admin.patch('/users/:id/role', requireRole('super_admin'), wrap(async (req, res) => {
    const { id } = uuidParam.parse(req.params);
    const { role } = roleChangeBody.parse(req.body);
    if (id === req.user!.id) throw badRequest('You cannot change your own role');
    if (!(await repo.setUserRole(id, role))) throw notFound();
    await repo.writeAudit(req.user!.id, 'user.role_change', 'user', id, { role });
    res.json({ data: { id, role } });
  }));
  app.use('/api/admin', admin);

  // validate answers schema is exported for tests/clients
  void answersSchema;

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
