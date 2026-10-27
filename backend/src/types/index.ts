export type RoleName = 'user' | 'super_admin' | 'content_admin' | 'reviewer';

export type VerificationStatus =
  | 'demonstration'
  | 'awaiting_verification'
  | 'verified'
  | 'outdated'
  | 'link_broken';

export type ServiceStatus = 'draft' | 'published' | 'archived';

export type RuleField =
  | 'state_code'
  | 'age'
  | 'occupation'
  | 'annual_income'
  | 'education_level'
  | 'gender'
  | 'category'
  | 'disability'
  | 'residency';

export type RuleOperator = 'eq' | 'neq' | 'in' | 'not_in' | 'gte' | 'lte' | 'between';

export interface EligibilityRule {
  id: string;
  service_id: string;
  field: RuleField;
  operator: RuleOperator;
  value: unknown;
  mandatory: boolean;
  question_text: string;
  explanation: string | null;
  description: string;
  sort_order: number;
}

export interface RequiredDocument {
  id: string;
  service_id: string;
  name: string;
  notes: string | null;
  is_mandatory: boolean;
  sort_order: number;
}

export interface ApplicationStep {
  id: string;
  service_id: string;
  step_number: number;
  title: string;
  details: string | null;
}

export interface OfficialSource {
  id: string;
  service_id: string;
  title: string;
  url: string;
  is_primary: boolean;
  link_status: 'unchecked' | 'ok' | 'broken';
}

export interface ServiceCategory {
  id: number;
  slug: string;
  name_en: string;
  name_hi: string | null;
  description_en: string | null;
  icon: string | null;
  sort_order: number;
}

export interface Service {
  id: string;
  slug: string;
  name: string;
  short_description: string;
  category_id: number;
  government_level: 'central' | 'state';
  state_code: string | null;
  target_beneficiaries: string[];
  fees_text: string | null;
  fees_verified: boolean;
  important_dates_text: string | null;
  dates_verified: boolean;
  application_url: string | null;
  tags: string[];
  status: ServiceStatus;
  verification_status: VerificationStatus;
  last_verified_at: string | null;
  verified_by: string | null;
  next_review_due: string | null;
  created_at: string;
  updated_at: string;
}

export interface ServiceDetail extends Service {
  category: ServiceCategory | null;
  rules: EligibilityRule[];
  documents: RequiredDocument[];
  steps: ApplicationStep[];
  sources: OfficialSource[];
}

export type Outcome = 'likely_eligible' | 'likely_not_eligible' | 'insufficient_information';

export interface Answers {
  state_code?: string;
  age?: number;
  occupation?: string;
  annual_income?: number;
  education_level?: string;
  gender?: string;
  category?: string;
  disability?: boolean;
  residency?: string;
}

export interface RuleCheck {
  rule_id: string;
  description: string;
  mandatory: boolean;
  result: 'met' | 'not_met' | 'unknown';
  field: RuleField;
}

export interface EligibilityResult {
  outcome: Outcome;
  reasons: string[];
  missing_facts: string[];
  checks: RuleCheck[];
  guidance: string[];
  disclaimer: string;
}

export interface AuthUser {
  id: string;
  email?: string;
  role: RoleName;
}

export interface Pagination {
  page: number;
  pageSize: number;
  total: number;
}
