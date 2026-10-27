import { describe, expect, it } from 'vitest';
import { evaluateEligibility, evaluateRule } from '../src/services/eligibility.js';
import type { EligibilityRule } from '../src/types/index.js';

const rule = (p: Partial<EligibilityRule>): EligibilityRule => ({
  id: 'r', service_id: 's', field: 'age', operator: 'gte', value: 60, mandatory: true,
  question_text: 'q', explanation: null, description: 'Age 60+', sort_order: 1, ...p,
});

describe('evaluateRule', () => {
  it('gte met / not met / unknown', () => {
    expect(evaluateRule(rule({}), { age: 60 })).toBe('met');
    expect(evaluateRule(rule({}), { age: 59 })).toBe('not_met');
    expect(evaluateRule(rule({}), {})).toBe('unknown');
  });
  it('between is inclusive and tolerates malformed values', () => {
    const r = rule({ operator: 'between', value: [15, 45] });
    expect(evaluateRule(r, { age: 15 })).toBe('met');
    expect(evaluateRule(r, { age: 45 })).toBe('met');
    expect(evaluateRule(r, { age: 46 })).toBe('not_met');
    expect(evaluateRule(rule({ operator: 'between', value: [45, 15] }), { age: 20 })).toBe('unknown');
    expect(evaluateRule(rule({ operator: 'between', value: 'x' }), { age: 20 })).toBe('unknown');
  });
  it('in / not_in / eq / neq', () => {
    const o = (operator: EligibilityRule['operator'], value: unknown) => rule({ field: 'occupation', operator, value });
    expect(evaluateRule(o('in', ['student', 'farmer']), { occupation: 'farmer' })).toBe('met');
    expect(evaluateRule(o('not_in', ['student']), { occupation: 'student' })).toBe('not_met');
    expect(evaluateRule(o('eq', 'student'), { occupation: 'farmer' })).toBe('not_met');
    expect(evaluateRule(o('neq', 'student'), { occupation: 'farmer' })).toBe('met');
    expect(evaluateRule(o('in', 'not-an-array'), { occupation: 'farmer' })).toBe('unknown');
  });
  it('does not coerce a string age into a number comparison', () => {
    expect(evaluateRule(rule({}), { age: '70' as unknown as number })).toBe('unknown');
  });
});

describe('evaluateEligibility', () => {
  const income = rule({ id: 'i', field: 'annual_income', operator: 'lte', value: 250000, description: 'Income limit' });
  const student = rule({ id: 's', field: 'occupation', operator: 'eq', value: 'student', description: 'Student' });

  it('likely_eligible when all mandatory rules are met', () => {
    const r = evaluateEligibility([income, student], { annual_income: 100000, occupation: 'student' });
    expect(r.outcome).toBe('likely_eligible');
    expect(r.missing_facts).toEqual([]);
  });
  it('likely_not_eligible when any mandatory rule fails, even if another is unknown', () => {
    const r = evaluateEligibility([income, student], { annual_income: 900000 });
    expect(r.outcome).toBe('likely_not_eligible');
    expect(r.reasons.join(' ')).toMatch(/Income limit/);
  });
  it('insufficient_information when a mandatory fact is missing and none failed', () => {
    const r = evaluateEligibility([income, student], { occupation: 'student' });
    expect(r.outcome).toBe('insufficient_information');
    expect(r.missing_facts).toContain('annual family income');
  });
  it('insufficient_information when no mandatory rules exist', () => {
    expect(evaluateEligibility([], {}).outcome).toBe('insufficient_information');
    const info = rule({ mandatory: false });
    expect(evaluateEligibility([info], { age: 30 }).outcome).toBe('insufficient_information');
  });
  it('non-mandatory rules never change the outcome', () => {
    const info = rule({ id: 'n', mandatory: false, description: 'Adult' });
    const r = evaluateEligibility([student, info], { occupation: 'student', age: 5 });
    expect(r.outcome).toBe('likely_eligible');
    expect(r.guidance.length).toBe(1);
  });
  it('always includes the disclaimer', () => {
    expect(evaluateEligibility([], {}).disclaimer).toMatch(/not a government decision/);
  });
});
