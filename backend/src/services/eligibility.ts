import type {
  Answers,
  EligibilityResult,
  EligibilityRule,
  RuleCheck,
  RuleField,
} from '../types/index.js';

export const ELIGIBILITY_DISCLAIMER =
  'This is a preliminary, unofficial indication based only on the information you provided. It is not a government decision and does not guarantee approval or rejection. Always confirm on the official source.';

const FIELD_LABELS: Record<RuleField, string> = {
  state_code: 'state or union territory',
  age: 'age',
  occupation: 'occupation / status',
  annual_income: 'annual family income',
  education_level: 'education level',
  gender: 'gender',
  category: 'beneficiary category',
  disability: 'disability status',
  residency: 'residency',
};

type Check = 'met' | 'not_met' | 'unknown';

function isNum(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

/** Evaluate a single rule against the answers. Never throws on malformed rule values. */
export function evaluateRule(rule: EligibilityRule, answers: Answers): Check {
  const actual = answers[rule.field];
  if (actual === undefined || actual === null || actual === '') return 'unknown';
  const v = rule.value;

  switch (rule.operator) {
    case 'eq':
      return actual === v ? 'met' : 'not_met';
    case 'neq':
      return actual !== v ? 'met' : 'not_met';
    case 'in':
      return Array.isArray(v) ? (v.includes(actual) ? 'met' : 'not_met') : 'unknown';
    case 'not_in':
      return Array.isArray(v) ? (!v.includes(actual) ? 'met' : 'not_met') : 'unknown';
    case 'gte':
      return isNum(actual) && isNum(v) ? (actual >= v ? 'met' : 'not_met') : 'unknown';
    case 'lte':
      return isNum(actual) && isNum(v) ? (actual <= v ? 'met' : 'not_met') : 'unknown';
    case 'between': {
      if (!isNum(actual) || !Array.isArray(v) || v.length !== 2) return 'unknown';
      const [lo, hi] = v;
      if (!isNum(lo) || !isNum(hi)) return 'unknown';
      if (lo > hi) return 'unknown'; // malformed rule
      return actual >= lo && actual <= hi ? 'met' : 'not_met';
    }
    default:
      return 'unknown';
  }
}

/**
 * Deterministic evaluation:
 *  - any mandatory rule NOT met            -> likely_not_eligible
 *  - else any mandatory rule unknown       -> insufficient_information
 *  - else (all mandatory met, or no rules with data) -> likely_eligible
 *  - a service with no mandatory rules     -> insufficient_information (nothing to base a result on)
 * Non-mandatory rules only produce guidance, never change the outcome.
 */
export function evaluateEligibility(
  rules: EligibilityRule[],
  answers: Answers,
): EligibilityResult {
  const checks: RuleCheck[] = rules.map((r) => ({
    rule_id: r.id,
    description: r.description,
    mandatory: r.mandatory,
    field: r.field,
    result: evaluateRule(r, answers),
  }));

  const mandatory = checks.filter((c) => c.mandatory);
  const failed = mandatory.filter((c) => c.result === 'not_met');
  const unknown = mandatory.filter((c) => c.result === 'unknown');
  const passed = mandatory.filter((c) => c.result === 'met');

  const reasons: string[] = [];
  const missing = [...new Set(unknown.map((c) => FIELD_LABELS[c.field]))];
  const guidance: string[] = [];

  for (const c of failed) reasons.push(`Does not appear to meet: ${c.description}.`);
  for (const c of passed) reasons.push(`Appears to meet: ${c.description}.`);

  for (const c of checks.filter((x) => !x.mandatory)) {
    if (c.result === 'met') guidance.push(`Note (not a condition): ${c.description}.`);
    else if (c.result === 'not_met')
      guidance.push(`Note (not a condition): ${c.description} — this may still matter in practice.`);
  }

  let outcome: EligibilityResult['outcome'];
  if (mandatory.length === 0) {
    outcome = 'insufficient_information';
    reasons.push(
      'No verified mandatory eligibility rules are recorded for this service. Please read the official criteria.',
    );
  } else if (failed.length > 0) {
    outcome = 'likely_not_eligible';
  } else if (unknown.length > 0) {
    outcome = 'insufficient_information';
    reasons.push('Some required facts were not provided, so a reliable indication is not possible.');
  } else {
    outcome = 'likely_eligible';
  }

  return {
    outcome,
    reasons,
    missing_facts: outcome === 'likely_not_eligible' ? [] : missing,
    checks,
    guidance,
    disclaimer: ELIGIBILITY_DISCLAIMER,
  };
}

/** Questions the client should ask: one per distinct field used by the service's rules. */
export function buildQuestions(rules: EligibilityRule[]) {
  const seen = new Set<RuleField>();
  const out: {
    field: RuleField;
    question: string;
    explanation: string | null;
    mandatory: boolean;
  }[] = [];
  for (const r of [...rules].sort((a, b) => a.sort_order - b.sort_order)) {
    if (seen.has(r.field)) continue;
    seen.add(r.field);
    out.push({
      field: r.field,
      question: r.question_text,
      explanation: r.explanation,
      mandatory: r.mandatory,
    });
  }
  return out;
}
