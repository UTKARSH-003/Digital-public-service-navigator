import type {
  Answers,
  AuthUser,
  Outcome,
  RoleName,
  Service,
  ServiceCategory,
  ServiceDetail,
  VerificationStatus,
} from '../types/index.js';
import type { ListServicesQuery, ServiceWrite } from '../validators/schemas.js';

export interface ListResult {
  items: Service[];
  total: number;
}

export interface Preferences {
  profiling_consent: boolean;
  state_code?: string | null;
  age_group?: string | null;
  occupation?: string | null;
  interests?: string[];
}

export interface ChecklistItem {
  id: string;
  user_id: string;
  service_id: string;
  item_type: 'document' | 'prerequisite' | 'step' | 'custom';
  label: string;
  is_done: boolean;
  application_reference: string | null;
  sort_order: number;
}

export interface AssessmentSummary {
  id: string;
  user_id: string;
  service_id: string;
  outcome: Outcome;
  reasons: string[];
  missing_facts: string[];
  created_at: string;
}

export interface FeedbackReport {
  id: string;
  service_id: string | null;
  user_id: string | null;
  report_type: string;
  message: string;
  status: 'open' | 'reviewing' | 'resolved' | 'dismissed';
  created_at: string;
}

export interface AuditEntry {
  id: string;
  actor_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  summary: Record<string, unknown>;
  created_at: string;
}

export interface Repo {
  // catalogue
  listCategories(): Promise<ServiceCategory[]>;
  listServices(q: ListServicesQuery, opts: { includeUnpublished: boolean }): Promise<ListResult>;
  getService(idOrSlug: string, opts: { includeUnpublished: boolean }): Promise<ServiceDetail | null>;
  /** Published services with their rules, used by recommendations and the assistant retriever. */
  listPublishedDetails(): Promise<ServiceDetail[]>;

  // search analytics (no PII beyond optional user id)
  recordSearch(query: string, resultCount: number, userId?: string): Promise<void>;
  searchStats(): Promise<{ topQueries: { query: string; count: number }[]; zeroResultQueries: string[]; totalSearches: number }>;

  // user data
  getPreferences(userId: string): Promise<Preferences | null>;
  upsertPreferences(userId: string, p: Preferences): Promise<Preferences>;
  listSaved(userId: string): Promise<{ id: string; service: Service; created_at: string }[]>;
  saveService(userId: string, serviceId: string): Promise<{ id: string }>;
  unsaveService(userId: string, savedId: string): Promise<boolean>;
  listChecklist(userId: string, serviceId?: string): Promise<ChecklistItem[]>;
  createChecklist(userId: string, serviceId: string, customItems: string[]): Promise<ChecklistItem[]>;
  patchChecklistItem(
    userId: string,
    itemId: string,
    patch: { is_done?: boolean; label?: string; application_reference?: string | null },
  ): Promise<ChecklistItem | null>;
  saveAssessment(
    userId: string,
    serviceId: string,
    outcome: Outcome,
    reasons: string[],
    missing: string[],
  ): Promise<void>;
  listAssessments(userId: string): Promise<AssessmentSummary[]>;
  exportUserData(userId: string): Promise<Record<string, unknown>>;
  deleteUserData(userId: string): Promise<void>;

  // feedback
  createFeedback(input: {
    service_id?: string;
    user_id?: string;
    report_type: string;
    message: string;
  }): Promise<{ id: string }>;
  listFeedback(status?: string): Promise<FeedbackReport[]>;
  updateFeedbackStatus(id: string, status: FeedbackReport['status'], actorId: string): Promise<boolean>;

  // admin
  createService(input: ServiceWrite, actorId: string): Promise<ServiceDetail>;
  updateService(id: string, patch: Partial<ServiceWrite>, actorId: string): Promise<ServiceDetail | null>;
  deleteService(id: string): Promise<boolean>;
  verificationQueue(): Promise<Service[]>;
  setVerification(
    id: string,
    to: VerificationStatus,
    reviewerId: string,
    notes?: string,
    nextReviewDays?: number,
  ): Promise<Service | null>;
  setUserRole(userId: string, role: RoleName): Promise<boolean>;
  listAudit(limit: number): Promise<AuditEntry[]>;
  writeAudit(
    actorId: string,
    action: string,
    entityType: string,
    entityId: string | null,
    summary?: Record<string, unknown>,
  ): Promise<void>;
  exportAllServices(): Promise<Service[]>;
  analyticsCounts(): Promise<{
    services: number;
    published: number;
    byVerification: Record<string, number>;
    openFeedback: number;
  }>;
}

export interface AuthVerifier {
  /** Returns the authenticated user (with role) or null if the token is invalid. */
  verify(token: string): Promise<AuthUser | null>;
}

export type { Answers };
