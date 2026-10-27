import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type {
  AuthUser,
  RoleName,
  Service,
  ServiceCategory,
  ServiceDetail,
  VerificationStatus,
} from '../types/index.js';
import type { ListServicesQuery, ServiceWrite } from '../validators/schemas.js';
import type {
  AssessmentSummary,
  AuditEntry,
  AuthVerifier,
  ChecklistItem,
  FeedbackReport,
  ListResult,
  Preferences,
  Repo,
} from './types.js';
import { HttpError } from '../utils/errors.js';

const ROLE_BY_ID: Record<number, RoleName> = { 1: 'user', 2: 'super_admin', 3: 'content_admin', 4: 'reviewer' };
const ROLE_ID: Record<RoleName, number> = { user: 1, super_admin: 2, content_admin: 3, reviewer: 4 };

function check<T>(res: { data: T | null; error: { message: string; code?: string } | null }): T {
  if (res.error) {
    if (res.error.code === '23505') throw new HttpError(409, 'conflict', 'A record with this value already exists');
    throw new Error(`database error: ${res.error.message}`);
  }
  return res.data as T;
}

/** Strip characters that have meaning in PostgREST filter syntax. */
function safeTerm(s: string) {
  return s.replace(/[^\p{L}\p{N}\s-]/gu, ' ').trim();
}

const DETAIL_SELECT =
  '*, category:service_categories(*), rules:eligibility_rules(*), documents:required_documents(*), steps:application_steps(*), sources:official_sources(*)';

export class SupabaseRepo implements Repo {
  readonly db: SupabaseClient;

  constructor(url: string, serviceKey: string) {
    this.db = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  }

  async listCategories(): Promise<ServiceCategory[]> {
    return check(await this.db.from('service_categories').select('*').order('sort_order'));
  }

  async listServices(q: ListServicesQuery, opts: { includeUnpublished: boolean }): Promise<ListResult> {
    let query = this.db.from('government_services').select('*', { count: 'exact' });
    if (!opts.includeUnpublished) query = query.eq('status', 'published');
    if (q.category) {
      const cat = check(await this.db.from('service_categories').select('id').eq('slug', q.category).maybeSingle()) as { id: number } | null;
      if (!cat) return { items: [], total: 0 };
      query = query.eq('category_id', cat.id);
    }
    if (q.state) query = query.or(`state_code.eq.${q.state},government_level.eq.central`);
    if (q.level) query = query.eq('government_level', q.level);
    if (q.q) {
      const term = safeTerm(q.q);
      if (term) {
        const words = term.split(/\s+/).filter(Boolean);
        const ors = words
          .flatMap((w) => [`name.ilike.%${w}%`, `short_description.ilike.%${w}%`, `tags.cs.{${w.toLowerCase()}}`])
          .join(',');
        query = query.or(ors);
      }
    }
    if (q.sort === 'name') query = query.order('name');
    else if (q.sort === 'recent') query = query.order('created_at', { ascending: false });
    else if (q.sort === 'verified') query = query.order('last_verified_at', { ascending: false, nullsFirst: false });
    else query = query.order('name');
    const from = (q.page - 1) * q.pageSize;
    const res = await query.range(from, from + q.pageSize - 1);
    if (res.error) throw new Error(`database error: ${res.error.message}`);
    return { items: (res.data ?? []) as Service[], total: res.count ?? 0 };
  }

  async getService(idOrSlug: string, opts: { includeUnpublished: boolean }) {
    const isUuid = /^[0-9a-f-]{36}$/i.test(idOrSlug);
    let query = this.db.from('government_services').select(DETAIL_SELECT);
    query = isUuid ? query.eq('id', idOrSlug) : query.eq('slug', idOrSlug);
    if (!opts.includeUnpublished) query = query.eq('status', 'published');
    const row = check(await query.maybeSingle()) as ServiceDetail | null;
    return row ? this.sortDetail(row) : null;
  }

  private sortDetail(d: ServiceDetail): ServiceDetail {
    d.rules?.sort((a, b) => a.sort_order - b.sort_order);
    d.documents?.sort((a, b) => a.sort_order - b.sort_order);
    d.steps?.sort((a, b) => a.step_number - b.step_number);
    return d;
  }

  async listPublishedDetails() {
    const rows = check(await this.db.from('government_services').select(DETAIL_SELECT).eq('status', 'published')) as ServiceDetail[];
    return rows.map((r) => this.sortDetail(r));
  }

  async recordSearch(query: string, resultCount: number, userId?: string) {
    await this.db.from('search_history').insert({ query: query.slice(0, 200), result_count: resultCount, user_id: userId ?? null });
  }

  async searchStats() {
    const rows = check(await this.db.from('search_history').select('query,result_count').order('created_at', { ascending: false }).limit(2000)) as { query: string; result_count: number }[];
    const counts = new Map<string, number>();
    for (const r of rows) counts.set(r.query.toLowerCase(), (counts.get(r.query.toLowerCase()) ?? 0) + 1);
    return {
      topQueries: [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([query, count]) => ({ query, count })),
      zeroResultQueries: [...new Set(rows.filter((r) => r.result_count === 0).map((r) => r.query.toLowerCase()))].slice(0, 20),
      totalSearches: rows.length,
    };
  }

  async getPreferences(userId: string) {
    return check(await this.db.from('user_preferences').select('*').eq('user_id', userId).maybeSingle()) as Preferences | null;
  }

  async upsertPreferences(userId: string, p: Preferences) {
    const row: Record<string, unknown> = p.profiling_consent
      ? { user_id: userId, profiling_consent: true, consent_at: new Date().toISOString(), state_code: p.state_code ?? null, age_group: p.age_group ?? null, occupation: p.occupation ?? null, interests: p.interests ?? [] }
      : { user_id: userId, profiling_consent: false, consent_at: null, state_code: null, age_group: null, occupation: null, interests: [] };
    return check(await this.db.from('user_preferences').upsert(row).select('*').single()) as Preferences;
  }

  async listSaved(userId: string) {
    const rows = check(await this.db.from('saved_services').select('id, created_at, service:government_services(*)').eq('user_id', userId).order('created_at', { ascending: false })) as unknown as { id: string; created_at: string; service: Service | null }[];
    return rows.flatMap((r) => (r.service ? [{ id: r.id, created_at: r.created_at, service: r.service }] : []));
  }

  async saveService(userId: string, serviceId: string) {
    return check(await this.db.from('saved_services').upsert({ user_id: userId, service_id: serviceId }, { onConflict: 'user_id,service_id' }).select('id').single()) as { id: string };
  }

  async unsaveService(userId: string, savedId: string) {
    const rows = check(await this.db.from('saved_services').delete().eq('id', savedId).eq('user_id', userId).select('id')) as { id: string }[];
    return rows.length > 0;
  }

  async listChecklist(userId: string, serviceId?: string) {
    let q = this.db.from('checklist_items').select('*').eq('user_id', userId).order('sort_order');
    if (serviceId) q = q.eq('service_id', serviceId);
    return check(await q) as ChecklistItem[];
  }

  async createChecklist(userId: string, serviceId: string, customItems: string[]) {
    const existing = await this.listChecklist(userId, serviceId);
    const svc = existing.length ? null : await this.getService(serviceId, { includeUnpublished: false });
    if (!existing.length && !svc) return [];
    let order = existing.length;
    const rows = [
      ...(svc ? svc.documents.map((d) => ({ item_type: 'document', label: d.name })) : []),
      ...(svc ? svc.steps.map((s) => ({ item_type: 'step', label: s.title })) : []),
      ...customItems.map((label) => ({ item_type: 'custom', label })),
    ].map((r) => ({ ...r, user_id: userId, service_id: serviceId, sort_order: order++ }));
    if (rows.length) check(await this.db.from('checklist_items').insert(rows).select('id'));
    return this.listChecklist(userId, serviceId);
  }

  async patchChecklistItem(userId: string, itemId: string, patch: { is_done?: boolean; label?: string; application_reference?: string | null }) {
    const clean: Record<string, unknown> = { ...patch };
    if (clean.application_reference === '') clean.application_reference = null;
    return check(await this.db.from('checklist_items').update(clean).eq('id', itemId).eq('user_id', userId).select('*').maybeSingle()) as ChecklistItem | null;
  }

  async saveAssessment(userId: string, serviceId: string, outcome: AssessmentSummary['outcome'], reasons: string[], missing: string[]) {
    check(await this.db.from('eligibility_assessments').insert({ user_id: userId, service_id: serviceId, outcome, reasons, missing_facts: missing }).select('id'));
  }

  async listAssessments(userId: string) {
    return check(await this.db.from('eligibility_assessments').select('*').eq('user_id', userId).order('created_at', { ascending: false })) as AssessmentSummary[];
  }

  async exportUserData(userId: string) {
    const [prefs, saved, checklist, assessments, feedback] = await Promise.all([
      this.getPreferences(userId),
      this.db.from('saved_services').select('*').eq('user_id', userId),
      this.db.from('checklist_items').select('*').eq('user_id', userId),
      this.db.from('eligibility_assessments').select('*').eq('user_id', userId),
      this.db.from('feedback_reports').select('*').eq('user_id', userId),
    ]);
    return { exported_at: new Date().toISOString(), preferences: prefs, saved_services: saved.data ?? [], checklist_items: checklist.data ?? [], assessments: assessments.data ?? [], feedback: feedback.data ?? [] };
  }

  async deleteUserData(userId: string) {
    // Deleting the auth user cascades to profiles and all user-owned tables (ON DELETE CASCADE);
    // feedback and search history are anonymised (ON DELETE SET NULL).
    const { error } = await this.db.auth.admin.deleteUser(userId);
    if (error) throw new Error(`account deletion failed: ${error.message}`);
  }

  async createFeedback(input: { service_id?: string; user_id?: string; report_type: string; message: string }) {
    return check(await this.db.from('feedback_reports').insert({ service_id: input.service_id ?? null, user_id: input.user_id ?? null, report_type: input.report_type, message: input.message }).select('id').single()) as { id: string };
  }

  async listFeedback(status?: string) {
    let q = this.db.from('feedback_reports').select('*').order('created_at', { ascending: false }).limit(200);
    if (status) q = q.eq('status', status);
    return check(await q) as FeedbackReport[];
  }

  async updateFeedbackStatus(id: string, status: FeedbackReport['status'], actorId: string) {
    const rows = check(await this.db.from('feedback_reports').update({ status, resolved_by: status === 'resolved' ? actorId : null }).eq('id', id).select('id')) as { id: string }[];
    return rows.length > 0;
  }

  private async replaceChildren(serviceId: string, input: Partial<ServiceWrite>) {
    if (input.rules) {
      check(await this.db.from('eligibility_rules').delete().eq('service_id', serviceId).select('id'));
      if (input.rules.length)
        check(await this.db.from('eligibility_rules').insert(input.rules.map((r, i) => ({ ...r, explanation: r.explanation ?? null, service_id: serviceId, sort_order: r.sort_order || i + 1 }))).select('id'));
    }
    if (input.documents) {
      check(await this.db.from('required_documents').delete().eq('service_id', serviceId).select('id'));
      if (input.documents.length)
        check(await this.db.from('required_documents').insert(input.documents.map((d, i) => ({ ...d, notes: d.notes ?? null, service_id: serviceId, sort_order: i + 1 }))).select('id'));
    }
    if (input.steps) {
      check(await this.db.from('application_steps').delete().eq('service_id', serviceId).select('id'));
      if (input.steps.length)
        check(await this.db.from('application_steps').insert(input.steps.map((s, i) => ({ ...s, details: s.details ?? null, service_id: serviceId, step_number: i + 1 }))).select('id'));
    }
    if (input.sources) {
      check(await this.db.from('official_sources').delete().eq('service_id', serviceId).select('id'));
      if (input.sources.length)
        check(await this.db.from('official_sources').insert(input.sources.map((s) => ({ ...s, service_id: serviceId }))).select('id'));
    }
  }

  async createService(input: ServiceWrite, actorId: string) {
    const { rules, documents, steps, sources, ...scalars } = input;
    const row = check(await this.db.from('government_services').insert({ ...scalars, verification_status: 'awaiting_verification', created_by: actorId }).select('id').single()) as { id: string };
    await this.replaceChildren(row.id, { rules, documents, steps, sources });
    return (await this.getService(row.id, { includeUnpublished: true })) as ServiceDetail;
  }

  async updateService(id: string, patch: Partial<ServiceWrite>) {
    const { rules, documents, steps, sources, ...scalars } = patch;
    if (Object.keys(scalars).length) {
      const rows = check(await this.db.from('government_services').update(scalars).eq('id', id).select('id')) as { id: string }[];
      if (!rows.length) return null;
    } else if (!(await this.getService(id, { includeUnpublished: true }))) return null;
    await this.replaceChildren(id, { rules, documents, steps, sources });
    return this.getService(id, { includeUnpublished: true });
  }

  async deleteService(id: string) {
    const rows = check(await this.db.from('government_services').delete().eq('id', id).select('id')) as { id: string }[];
    return rows.length > 0;
  }

  async verificationQueue() {
    const today = new Date().toISOString().slice(0, 10);
    return check(await this.db.from('government_services').select('*').neq('status', 'archived').or(`verification_status.neq.verified,next_review_due.lte.${today}`).order('updated_at', { ascending: false }).limit(200)) as Service[];
  }

  async setVerification(id: string, to: VerificationStatus, reviewerId: string, notes?: string, nextReviewDays?: number) {
    const current = check(await this.db.from('government_services').select('verification_status').eq('id', id).maybeSingle()) as { verification_status: string } | null;
    if (!current) return null;
    const update: Record<string, unknown> = { verification_status: to };
    if (to === 'verified') {
      update.last_verified_at = new Date().toISOString();
      update.verified_by = reviewerId;
      update.next_review_due = new Date(Date.now() + (nextReviewDays ?? 180) * 86400000).toISOString().slice(0, 10);
    }
    const row = check(await this.db.from('government_services').update(update).eq('id', id).select('*').single()) as Service;
    check(await this.db.from('service_verification_logs').insert({ service_id: id, reviewer_id: reviewerId, from_status: current.verification_status, to_status: to, notes: notes ?? null }).select('id'));
    return row;
  }

  async setUserRole(userId: string, role: RoleName) {
    const rows = check(await this.db.from('profiles').update({ role_id: ROLE_ID[role] }).eq('id', userId).select('id')) as { id: string }[];
    return rows.length > 0;
  }

  async listAudit(limit: number) {
    return check(await this.db.from('admin_audit_logs').select('*').order('created_at', { ascending: false }).limit(limit)) as AuditEntry[];
  }

  async writeAudit(actorId: string, action: string, entityType: string, entityId: string | null, summary: Record<string, unknown> = {}) {
    check(await this.db.from('admin_audit_logs').insert({ actor_id: actorId, action, entity_type: entityType, entity_id: entityId, summary }).select('id'));
  }

  async exportAllServices() {
    return check(await this.db.from('government_services').select('*').order('name')) as Service[];
  }

  async analyticsCounts() {
    const rows = check(await this.db.from('government_services').select('status,verification_status')) as { status: string; verification_status: string }[];
    const byVerification: Record<string, number> = {};
    for (const r of rows) byVerification[r.verification_status] = (byVerification[r.verification_status] ?? 0) + 1;
    const fb = await this.db.from('feedback_reports').select('id', { count: 'exact', head: true }).eq('status', 'open');
    return { services: rows.length, published: rows.filter((r) => r.status === 'published').length, byVerification, openFeedback: fb.count ?? 0 };
  }
}

/** Verifies a Supabase access token by asking Supabase Auth, then loads the role from profiles. */
export class SupabaseAuthVerifier implements AuthVerifier {
  constructor(private repo: SupabaseRepo) {}

  async verify(token: string): Promise<AuthUser | null> {
    const { data, error } = await this.repo.db.auth.getUser(token);
    if (error || !data.user) return null;
    const profile = check(await this.repo.db.from('profiles').select('role_id').eq('id', data.user.id).maybeSingle()) as { role_id: number } | null;
    return { id: data.user.id, email: data.user.email, role: ROLE_BY_ID[profile?.role_id ?? 1] ?? 'user' };
  }
}
