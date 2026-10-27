import { randomUUID } from 'node:crypto';
import type {
  EligibilityRule,
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
  ChecklistItem,
  FeedbackReport,
  ListResult,
  Preferences,
  Repo,
} from './types.js';

const now = () => new Date().toISOString();

export const CATEGORY_SEED: Omit<ServiceCategory, 'id'>[] = [
  ['identity-documents', 'Identity and essential documents', 'पहचान और आवश्यक दस्तावेज', 'id-card'],
  ['education-scholarships', 'Education and scholarships', 'शिक्षा और छात्रवृत्ति', 'graduation-cap'],
  ['employment-skills', 'Employment and skill development', 'रोजगार और कौशल विकास', 'briefcase'],
  ['healthcare-welfare', 'Healthcare and welfare', 'स्वास्थ्य और कल्याण', 'heart-pulse'],
  ['agriculture', 'Agriculture and farming', 'कृषि और खेती', 'sprout'],
  ['women-child', 'Women and child welfare', 'महिला एवं बाल कल्याण', 'baby'],
  ['pension-senior', 'Pension and senior citizen services', 'पेंशन और वरिष्ठ नागरिक सेवाएं', 'hand-heart'],
  ['business-entrepreneurship', 'Business registration and entrepreneurship', 'व्यवसाय पंजीकरण और उद्यमिता', 'store'],
  ['taxation-finance', 'Taxation and financial assistance', 'कराधान और वित्तीय सहायता', 'landmark'],
  ['housing-utilities', 'Housing and public utilities', 'आवास और सार्वजनिक सुविधाएं', 'home'],
  ['certificates-state', 'Certificates and state-level services', 'प्रमाणपत्र और राज्य स्तरीय सेवाएं', 'file-badge'],
  ['disability-accessibility', 'Disability benefits and accessibility services', 'दिव्यांगजन लाभ और सुलभता सेवाएं', 'accessibility'],
].map(([slug, name_en, name_hi, icon], i) => ({
  slug: slug as string,
  name_en: name_en as string,
  name_hi: name_hi as string,
  description_en: null,
  icon: icon as string,
  sort_order: i + 1,
}));

type RuleSeed = [EligibilityRule['field'], EligibilityRule['operator'], unknown, boolean, string, string, string];

interface SeedService {
  slug: string;
  name: string;
  desc: string;
  cat: string;
  beneficiaries: string[];
  tags: string[];
  source: [string, string];
  rules: RuleSeed[];
  docs: [string, string, boolean][];
}

// DEMONSTRATION records only. Mirrors database/seed/001_seed.sql. Not verified against live sources.
const SERVICE_SEED: SeedService[] = [
  {
    slug: 'demo-post-matric-scholarship',
    name: 'Post-matric scholarship (demonstration record)',
    desc: 'Illustrative record for a scholarship aimed at students beyond Class 10. Details are unverified; confirm on the official portal.',
    cat: 'education-scholarships',
    beneficiaries: ['students'],
    tags: ['scholarship', 'student', 'education', 'fees'],
    source: ['National Scholarship Portal', 'https://scholarships.gov.in/'],
    rules: [
      ['occupation', 'eq', 'student', true, 'Are you currently a student?', 'Scholarships are usually for enrolled students.', 'Applicant must be a student (illustrative)'],
      ['annual_income', 'lte', 250000, true, "What is your family's approximate annual income (INR)?", 'Many scholarships have an income ceiling. The real limit must be confirmed on the official portal.', 'Family income at or below an illustrative ceiling'],
    ],
    docs: [
      ['Proof of enrolment', 'Bonafide certificate or ID card from institution', true],
      ['Income certificate', 'From the competent authority in your state', true],
      ['Bank account details', "Account in the applicant's name", true],
    ],
  },
  {
    slug: 'demo-farmer-income-support',
    name: 'Farmer income support (demonstration record)',
    desc: 'Illustrative record for a direct income support scheme for farming families. Details are unverified; confirm on the official portal.',
    cat: 'agriculture',
    beneficiaries: ['farmers'],
    tags: ['farmer', 'agriculture', 'income support', 'kisan'],
    source: ['myScheme (scheme search)', 'https://www.myscheme.gov.in/'],
    rules: [
      ['occupation', 'eq', 'farmer', true, 'Are you a farmer?', 'This scheme type targets farming families.', 'Applicant must be a farmer (illustrative)'],
    ],
    docs: [
      ['Land ownership record', 'As issued by your state revenue department', true],
      ['Bank account details', "Account in the applicant's name", true],
    ],
  },
  {
    slug: 'demo-income-certificate',
    name: 'Income certificate (demonstration record)',
    desc: 'Illustrative record for obtaining an income certificate. Issuing authority and process vary by state; confirm with your state portal.',
    cat: 'certificates-state',
    beneficiaries: ['all citizens'],
    tags: ['certificate', 'income', 'document'],
    source: ['National Portal of India: services', 'https://services.india.gov.in/'],
    rules: [
      ['age', 'gte', 18, false, 'What is your age?', 'Minors are usually applied for by a guardian. Informational only.', 'Adult applicant (informational)'],
    ],
    docs: [
      ['Proof of address', 'Any government-recognised address proof', true],
      ['Income declaration', 'Self-declaration or supporting income proof', true],
    ],
  },
  {
    slug: 'demo-old-age-pension',
    name: 'Old age pension (demonstration record)',
    desc: 'Illustrative record for a social pension for senior citizens. Rules differ across states; confirm on the official portal.',
    cat: 'pension-senior',
    beneficiaries: ['senior citizens'],
    tags: ['pension', 'senior citizen', 'old age'],
    source: ['myScheme (scheme search)', 'https://www.myscheme.gov.in/'],
    rules: [
      ['age', 'gte', 60, true, 'What is your age?', 'Senior citizen pensions commonly start at 60; the real threshold varies.', 'Age 60 or above (illustrative)'],
    ],
    docs: [
      ['Age proof', 'Any government-recognised age proof', true],
      ['Bank account details', "Account in the applicant's name", true],
    ],
  },
  {
    slug: 'demo-skill-training',
    name: 'Skill training programme (demonstration record)',
    desc: 'Illustrative record for short-term skill training for job seekers. Details are unverified; confirm on the official portal.',
    cat: 'employment-skills',
    beneficiaries: ['job seekers', 'youth'],
    tags: ['skill', 'training', 'job', 'youth'],
    source: ['myScheme (scheme search)', 'https://www.myscheme.gov.in/'],
    rules: [
      ['age', 'between', [15, 45], true, 'What is your age?', 'Training programmes often have an age band; confirm the real one.', 'Age between 15 and 45 (illustrative)'],
    ],
    docs: [
      ['Photo ID', 'Any government-recognised photo ID', true],
      ['Education certificates', 'Highest qualification, if any', false],
    ],
  },
  {
    slug: 'demo-msme-registration',
    name: 'Small business registration (demonstration record)',
    desc: 'Illustrative record for registering a micro or small enterprise. Details are unverified; confirm on the official portal.',
    cat: 'business-entrepreneurship',
    beneficiaries: ['entrepreneurs'],
    tags: ['business', 'msme', 'registration', 'entrepreneur'],
    source: ['National Portal of India', 'https://www.india.gov.in/'],
    rules: [
      ['occupation', 'eq', 'entrepreneur', false, 'Do you run or plan to run a business?', 'Informational: registration is for business owners.', 'Business owner or planner (informational)'],
    ],
    docs: [
      ['Business details', 'Name, address, activity and start date', true],
      ['Bank account details', 'Business or proprietor account', true],
    ],
  },
];

const GENERIC_STEPS: [string, string][] = [
  ['Open the official portal', 'Use the official source link shown on this page, not links from messages or ads.'],
  ['Confirm eligibility', 'Read the official eligibility criteria and compare them with your situation.'],
  ['Prepare documents', 'Gather the documents listed on this page and check them against the official list.'],
  ['Apply on the official portal', 'Fill in the application as per the official instructions. Never share OTPs or passwords with anyone.'],
  ['Keep your reference number', 'Note your application reference number to follow up with the department.'],
];

export class MemoryRepo implements Repo {
  categories: ServiceCategory[] = [];
  services = new Map<string, ServiceDetail>();
  saved: { id: string; user_id: string; service_id: string; created_at: string }[] = [];
  checklist: ChecklistItem[] = [];
  assessments: AssessmentSummary[] = [];
  feedback: FeedbackReport[] = [];
  audit: AuditEntry[] = [];
  searches: { query: string; count: number; user_id?: string }[] = [];
  prefs = new Map<string, Preferences>();
  roles = new Map<string, RoleName>();
  deletedUsers = new Set<string>();

  constructor(seed = true) {
    if (seed) this.seed();
  }

  private seed() {
    this.categories = CATEGORY_SEED.map((c, i) => ({ id: i + 1, ...c }));
    for (const s of SERVICE_SEED) {
      const id = randomUUID();
      const cat = this.categories.find((c) => c.slug === s.cat) ?? null;
      const ts = now();
      this.services.set(id, {
        id,
        slug: s.slug,
        name: s.name,
        short_description: s.desc,
        category_id: cat?.id ?? 1,
        government_level: 'central',
        state_code: null,
        target_beneficiaries: s.beneficiaries,
        fees_text: null,
        fees_verified: false,
        important_dates_text: null,
        dates_verified: false,
        application_url: null,
        tags: s.tags,
        status: 'published',
        verification_status: 'demonstration',
        last_verified_at: null,
        verified_by: null,
        next_review_due: null,
        created_at: ts,
        updated_at: ts,
        category: cat,
        rules: s.rules.map((r, i) => ({
          id: randomUUID(),
          service_id: id,
          field: r[0],
          operator: r[1],
          value: r[2],
          mandatory: r[3],
          question_text: r[4],
          explanation: r[5],
          description: r[6],
          sort_order: i + 1,
        })),
        documents: s.docs.map((d, i) => ({
          id: randomUUID(),
          service_id: id,
          name: d[0],
          notes: d[1],
          is_mandatory: d[2],
          sort_order: i + 1,
        })),
        steps: GENERIC_STEPS.map((st, i) => ({
          id: randomUUID(),
          service_id: id,
          step_number: i + 1,
          title: st[0],
          details: st[1],
        })),
        sources: [
          {
            id: randomUUID(),
            service_id: id,
            title: s.source[0],
            url: s.source[1],
            is_primary: true,
            link_status: 'unchecked',
          },
        ],
      });
    }
  }

  private plain(d: ServiceDetail): Service {
    const { category: _c, rules: _r, documents: _d, steps: _s, sources: _so, ...rest } = d;
    void _c; void _r; void _d; void _s; void _so;
    return rest;
  }

  async listCategories() {
    return [...this.categories].sort((a, b) => a.sort_order - b.sort_order);
  }

  async listServices(q: ListServicesQuery, opts: { includeUnpublished: boolean }): Promise<ListResult> {
    let items = [...this.services.values()].filter(
      (s) => opts.includeUnpublished || s.status === 'published',
    );
    if (q.category) {
      const cat = this.categories.find((c) => c.slug === q.category);
      items = items.filter((s) => s.category_id === cat?.id);
    }
    if (q.state) items = items.filter((s) => s.state_code === q.state || s.government_level === 'central');
    if (q.level) items = items.filter((s) => s.government_level === q.level);
    if (q.q) {
      const terms = q.q.toLowerCase().split(/\s+/).filter(Boolean);
      const score = (s: ServiceDetail) => {
        const hay = `${s.name} ${s.short_description} ${s.tags.join(' ')}`.toLowerCase();
        let n = 0;
        for (const t of terms) {
          if (s.name.toLowerCase().includes(t)) n += 3;
          else if (s.tags.some((x) => x.toLowerCase().includes(t))) n += 2;
          else if (hay.includes(t)) n += 1;
        }
        return n;
      };
      const scored = items.map((s) => ({ s, n: score(s) })).filter((x) => x.n > 0);
      if (q.sort === 'relevance') scored.sort((a, b) => b.n - a.n);
      items = scored.map((x) => x.s);
    }
    if (q.sort === 'name') items.sort((a, b) => a.name.localeCompare(b.name));
    if (q.sort === 'recent') items.sort((a, b) => b.created_at.localeCompare(a.created_at));
    if (q.sort === 'verified')
      items.sort((a, b) => (b.last_verified_at ?? '').localeCompare(a.last_verified_at ?? ''));
    const total = items.length;
    const start = (q.page - 1) * q.pageSize;
    return { items: items.slice(start, start + q.pageSize).map((d) => this.plain(d)), total };
  }

  async getService(idOrSlug: string, opts: { includeUnpublished: boolean }) {
    const d =
      this.services.get(idOrSlug) ?? [...this.services.values()].find((s) => s.slug === idOrSlug);
    if (!d) return null;
    if (!opts.includeUnpublished && d.status !== 'published') return null;
    return d;
  }

  async listPublishedDetails() {
    return [...this.services.values()].filter((s) => s.status === 'published');
  }

  async recordSearch(query: string, resultCount: number, userId?: string) {
    this.searches.push({ query: query.slice(0, 200), count: resultCount, user_id: userId });
  }

  async searchStats() {
    const counts = new Map<string, number>();
    for (const s of this.searches) {
      const k = s.query.toLowerCase();
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    return {
      topQueries: [...counts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([query, count]) => ({ query, count })),
      zeroResultQueries: [...new Set(this.searches.filter((s) => s.count === 0).map((s) => s.query.toLowerCase()))].slice(0, 20),
      totalSearches: this.searches.length,
    };
  }

  async getPreferences(userId: string) {
    return this.prefs.get(userId) ?? null;
  }
  async upsertPreferences(userId: string, p: Preferences) {
    // Without consent nothing but the consent flag itself is stored.
    const stored: Preferences = p.profiling_consent
      ? { ...p, interests: p.interests ?? [] }
      : { profiling_consent: false, state_code: null, age_group: null, occupation: null, interests: [] };
    this.prefs.set(userId, stored);
    return stored;
  }

  async listSaved(userId: string) {
    return this.saved
      .filter((s) => s.user_id === userId)
      .flatMap((s) => {
        const d = this.services.get(s.service_id);
        return d ? [{ id: s.id, service: this.plain(d), created_at: s.created_at }] : [];
      });
  }
  async saveService(userId: string, serviceId: string) {
    const existing = this.saved.find((s) => s.user_id === userId && s.service_id === serviceId);
    if (existing) return { id: existing.id };
    const row = { id: randomUUID(), user_id: userId, service_id: serviceId, created_at: now() };
    this.saved.push(row);
    return { id: row.id };
  }
  async unsaveService(userId: string, savedId: string) {
    const i = this.saved.findIndex((s) => s.id === savedId && s.user_id === userId);
    if (i < 0) return false;
    this.saved.splice(i, 1);
    return true;
  }

  async listChecklist(userId: string, serviceId?: string) {
    return this.checklist
      .filter((c) => c.user_id === userId && (!serviceId || c.service_id === serviceId))
      .sort((a, b) => a.sort_order - b.sort_order);
  }
  async createChecklist(userId: string, serviceId: string, customItems: string[]) {
    const d = this.services.get(serviceId);
    if (!d) return [];
    // idempotent: re-creating never duplicates documents/steps; extra custom items are appended
    const existing = await this.listChecklist(userId, serviceId);
    const items: ChecklistItem[] = [];
    let order = existing.length;
    if (existing.length) {
      for (const label of customItems)
        items.push({ id: randomUUID(), user_id: userId, service_id: serviceId, item_type: 'custom', label, is_done: false, application_reference: null, sort_order: order++ });
      this.checklist.push(...items);
      return this.listChecklist(userId, serviceId);
    }
    const push = (item_type: ChecklistItem['item_type'], label: string) =>
      items.push({
        id: randomUUID(),
        user_id: userId,
        service_id: serviceId,
        item_type,
        label,
        is_done: false,
        application_reference: null,
        sort_order: order++,
      });
    for (const doc of d.documents) push('document', doc.name);
    for (const st of d.steps) push('step', st.title);
    for (const c of customItems) push('custom', c);
    this.checklist.push(...items);
    return items;
  }
  async patchChecklistItem(
    userId: string,
    itemId: string,
    patch: { is_done?: boolean; label?: string; application_reference?: string | null },
  ) {
    const item = this.checklist.find((c) => c.id === itemId && c.user_id === userId);
    if (!item) return null;
    if (patch.is_done !== undefined) item.is_done = patch.is_done;
    if (patch.label !== undefined) item.label = patch.label;
    if (patch.application_reference !== undefined)
      item.application_reference = patch.application_reference || null;
    return item;
  }

  async saveAssessment(userId: string, serviceId: string, outcome: AssessmentSummary['outcome'], reasons: string[], missing: string[]) {
    this.assessments.push({
      id: randomUUID(),
      user_id: userId,
      service_id: serviceId,
      outcome,
      reasons,
      missing_facts: missing,
      created_at: now(),
    });
  }
  async listAssessments(userId: string) {
    return this.assessments.filter((a) => a.user_id === userId).reverse();
  }

  async exportUserData(userId: string) {
    return {
      exported_at: now(),
      preferences: this.prefs.get(userId) ?? null,
      saved_services: this.saved.filter((s) => s.user_id === userId),
      checklist_items: this.checklist.filter((c) => c.user_id === userId),
      assessments: this.assessments.filter((a) => a.user_id === userId),
      feedback: this.feedback.filter((f) => f.user_id === userId),
    };
  }
  async deleteUserData(userId: string) {
    this.saved = this.saved.filter((s) => s.user_id !== userId);
    this.checklist = this.checklist.filter((c) => c.user_id !== userId);
    this.assessments = this.assessments.filter((a) => a.user_id !== userId);
    this.feedback = this.feedback.map((f) => (f.user_id === userId ? { ...f, user_id: null } : f));
    this.searches = this.searches.map((s) => (s.user_id === userId ? { ...s, user_id: undefined } : s));
    this.prefs.delete(userId);
    this.roles.delete(userId);
    this.deletedUsers.add(userId);
  }

  async createFeedback(input: { service_id?: string; user_id?: string; report_type: string; message: string }) {
    const row: FeedbackReport = {
      id: randomUUID(),
      service_id: input.service_id ?? null,
      user_id: input.user_id ?? null,
      report_type: input.report_type,
      message: input.message,
      status: 'open',
      created_at: now(),
    };
    this.feedback.push(row);
    return { id: row.id };
  }
  async listFeedback(status?: string) {
    return this.feedback.filter((f) => !status || f.status === status).reverse();
  }
  async updateFeedbackStatus(id: string, status: FeedbackReport['status']) {
    const f = this.feedback.find((x) => x.id === id);
    if (!f) return false;
    f.status = status;
    return true;
  }

  private applyWrite(d: ServiceDetail, input: Partial<ServiceWrite>) {
    const { rules, documents, steps, sources, ...scalars } = input;
    Object.assign(d, scalars);
    d.category = this.categories.find((c) => c.id === d.category_id) ?? null;
    if (rules)
      d.rules = rules.map((r, i) => ({
        id: randomUUID(),
        service_id: d.id,
        field: r.field,
        operator: r.operator,
        value: r.value,
        mandatory: r.mandatory,
        question_text: r.question_text,
        explanation: r.explanation ?? null,
        description: r.description,
        sort_order: r.sort_order || i + 1,
      }));
    if (documents)
      d.documents = documents.map((x, i) => ({
        id: randomUUID(),
        service_id: d.id,
        name: x.name,
        notes: x.notes ?? null,
        is_mandatory: x.is_mandatory,
        sort_order: i + 1,
      }));
    if (steps)
      d.steps = steps.map((x, i) => ({
        id: randomUUID(),
        service_id: d.id,
        step_number: i + 1,
        title: x.title,
        details: x.details ?? null,
      }));
    if (sources)
      d.sources = sources.map((x) => ({
        id: randomUUID(),
        service_id: d.id,
        title: x.title,
        url: x.url,
        is_primary: x.is_primary,
        link_status: 'unchecked' as const,
      }));
    d.updated_at = now();
  }

  async createService(input: ServiceWrite, actorId: string) {
    if ([...this.services.values()].some((s) => s.slug === input.slug))
      throw Object.assign(new Error('duplicate slug'), { code: 'duplicate_slug' });
    const id = randomUUID();
    const ts = now();
    const d: ServiceDetail = {
      id,
      slug: input.slug,
      name: input.name,
      short_description: input.short_description,
      category_id: input.category_id,
      government_level: input.government_level,
      state_code: input.state_code ?? null,
      target_beneficiaries: input.target_beneficiaries,
      fees_text: input.fees_text ?? null,
      fees_verified: input.fees_verified,
      important_dates_text: input.important_dates_text ?? null,
      dates_verified: input.dates_verified,
      application_url: input.application_url ?? null,
      tags: input.tags,
      status: input.status,
      // New content is never "verified": it must go through the verification workflow.
      verification_status: 'awaiting_verification',
      last_verified_at: null,
      verified_by: null,
      next_review_due: null,
      created_at: ts,
      updated_at: ts,
      category: this.categories.find((c) => c.id === input.category_id) ?? null,
      rules: [],
      documents: [],
      steps: [],
      sources: [],
    };
    this.applyWrite(d, { rules: input.rules, documents: input.documents, steps: input.steps, sources: input.sources });
    this.services.set(id, d);
    void actorId;
    return d;
  }
  async updateService(id: string, patch: Partial<ServiceWrite>) {
    const d = this.services.get(id);
    if (!d) return null;
    this.applyWrite(d, patch);
    return d;
  }
  async deleteService(id: string) {
    return this.services.delete(id);
  }
  async verificationQueue() {
    const today = new Date().toISOString().slice(0, 10);
    return [...this.services.values()]
      .filter(
        (s) =>
          s.status !== 'archived' &&
          (s.verification_status !== 'verified' || (s.next_review_due !== null && s.next_review_due <= today)),
      )
      .map((d) => this.plain(d));
  }
  async setVerification(id: string, to: VerificationStatus, reviewerId: string, _notes?: string, nextReviewDays?: number) {
    const d = this.services.get(id);
    if (!d) return null;
    d.verification_status = to;
    if (to === 'verified') {
      d.last_verified_at = now();
      d.verified_by = reviewerId;
      const due = new Date(Date.now() + (nextReviewDays ?? 180) * 86400000);
      d.next_review_due = due.toISOString().slice(0, 10);
    }
    d.updated_at = now();
    return this.plain(d);
  }
  async setUserRole(userId: string, role: RoleName) {
    this.roles.set(userId, role);
    return true;
  }
  async listAudit(limit: number) {
    return [...this.audit].reverse().slice(0, limit);
  }
  async writeAudit(actorId: string, action: string, entityType: string, entityId: string | null, summary: Record<string, unknown> = {}) {
    this.audit.push({
      id: randomUUID(),
      actor_id: actorId,
      action,
      entity_type: entityType,
      entity_id: entityId,
      summary,
      created_at: now(),
    });
  }
  async exportAllServices() {
    return [...this.services.values()].map((d) => this.plain(d));
  }
  async analyticsCounts() {
    const all = [...this.services.values()];
    const byVerification: Record<string, number> = {};
    for (const s of all) byVerification[s.verification_status] = (byVerification[s.verification_status] ?? 0) + 1;
    return {
      services: all.length,
      published: all.filter((s) => s.status === 'published').length,
      byVerification,
      openFeedback: this.feedback.filter((f) => f.status === 'open').length,
    };
  }
}
