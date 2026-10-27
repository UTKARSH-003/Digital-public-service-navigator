export type VerificationStatus = 'demonstration' | 'awaiting_verification' | 'verified' | 'outdated' | 'link_broken';
export type RoleName = 'user' | 'super_admin' | 'content_admin' | 'reviewer';

export interface Category { id: number; slug: string; name_en: string; name_hi: string | null; icon: string | null }
export interface Service {
  id: string; slug: string; name: string; short_description: string; category_id: number;
  government_level: 'central' | 'state'; state_code: string | null; target_beneficiaries: string[];
  fees_text: string | null; fees_verified: boolean; important_dates_text: string | null; dates_verified: boolean;
  application_url: string | null; tags: string[]; status: 'draft' | 'published' | 'archived';
  verification_status: VerificationStatus; last_verified_at: string | null; updated_at: string;
}
export interface Rule { id: string; mandatory: boolean; description: string; field: string }
export interface Doc { id: string; name: string; notes: string | null; is_mandatory: boolean }
export interface Step { id: string; step_number: number; title: string; details: string | null }
export interface Source { id: string; title: string; url: string }
export interface Question { field: string; question: string; explanation: string | null; mandatory: boolean }
export interface ServiceDetail extends Service {
  category: Category | null; rules: Rule[]; documents: Doc[]; steps: Step[]; sources: Source[];
  eligibility_questions: Question[];
}
export type Outcome = 'likely_eligible' | 'likely_not_eligible' | 'insufficient_information';
export interface EligibilityResponse {
  outcome: Outcome; reasons: string[]; missing_facts: string[]; guidance: string[]; disclaimer: string; saved: boolean;
  official_sources: { title: string; url: string }[]; documents: Doc[]; steps: Step[];
  service: { id: string; name: string; verification_status: VerificationStatus };
}
export interface Paged<T> { data: T[]; meta: { page: number; pageSize: number; total: number } }
export interface AssistantReply {
  answer: string; intent: string; mode: 'fallback' | 'ai';
  services: { id: string; slug: string; name: string; short_description: string; verification_status: VerificationStatus }[];
  citations: { service_id: string; title: string; url: string }[];
  clarifying_question: string | null; related: { id: string; name: string }[]; verified: boolean; notice: string;
}
export interface ChecklistItem { id: string; service_id: string; item_type: string; label: string; is_done: boolean; application_reference: string | null }
export interface Recommendation { service: Service; score: number; reasons: string[] }
