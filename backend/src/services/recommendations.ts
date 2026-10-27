import type { ServiceDetail } from '../types/index.js';
import type { Preferences } from '../repositories/types.js';

export interface Recommendation {
  service: Omit<ServiceDetail, 'rules' | 'documents' | 'steps' | 'sources' | 'category'>;
  score: number;
  reasons: string[];
}

const OCC_TO_BENEFICIARY: Record<string, string[]> = {
  student: ['students'],
  farmer: ['farmers'],
  entrepreneur: ['entrepreneurs'],
  unemployed: ['job seekers', 'youth'],
};

const AGE_BOUNDS: Record<string, [number, number]> = {
  under_18: [0, 17],
  '18_25': [18, 25],
  '26_40': [26, 40],
  '41_59': [41, 59],
  '60_plus': [60, 120],
};

/**
 * Transparent additive scoring. Each signal adds a fixed number of points and a human-readable reason.
 * Only fields the user explicitly provided AND consented to share are used.
 *  +3 jurisdiction match (state service for the user's state)
 *  +1 central service (applies everywhere)
 *  +3 beneficiary-category match with occupation
 *  +2 per interest matching a tag/name (max 2 interests counted)
 *  +2 age band is compatible with a mandatory age rule
 *  -5 age band is incompatible with a mandatory age rule (hidden if score <= 0)
 *  +1 category of a recently viewed / saved service
 */
export function recommend(
  services: ServiceDetail[],
  prefs: Preferences | null,
  context: { savedCategoryIds?: number[]; viewedCategoryIds?: number[] } = {},
  limit = 6,
): Recommendation[] {
  const consent = Boolean(prefs?.profiling_consent);
  const state = consent ? prefs?.state_code ?? null : null;
  const occupation = consent ? prefs?.occupation ?? null : null;
  const ageGroup = consent ? prefs?.age_group ?? null : null;
  const interests = consent ? (prefs?.interests ?? []).map((i) => i.toLowerCase()) : [];
  const touched = new Set([...(context.savedCategoryIds ?? []), ...(context.viewedCategoryIds ?? [])]);

  const out: Recommendation[] = [];
  for (const s of services) {
    let score = 0;
    const reasons: string[] = [];

    if (s.government_level === 'state' && state && s.state_code === state) {
      score += 3;
      reasons.push(`Available in your state (${state})`);
    } else if (s.government_level === 'state' && state && s.state_code !== state) {
      continue; // different state: not applicable
    } else if (s.government_level === 'central') {
      score += 1;
      reasons.push('Central service available across India');
    }

    if (occupation) {
      const wanted = OCC_TO_BENEFICIARY[occupation] ?? [];
      if (s.target_beneficiaries.some((b) => wanted.includes(b.toLowerCase()))) {
        score += 3;
        reasons.push(`Designed for ${s.target_beneficiaries.join(', ')}, matching your selected status`);
      }
    }

    let counted = 0;
    for (const i of interests) {
      if (counted >= 2) break;
      const hay = `${s.name} ${s.tags.join(' ')} ${s.short_description}`.toLowerCase();
      if (hay.includes(i)) {
        score += 2;
        counted++;
        reasons.push(`Matches your interest: ${i}`);
      }
    }

    if (ageGroup) {
      const [lo, hi] = AGE_BOUNDS[ageGroup] ?? [0, 120];
      for (const r of s.rules.filter((x) => x.mandatory && x.field === 'age')) {
        const v = r.value;
        let compatible = true;
        if (r.operator === 'gte' && typeof v === 'number') compatible = hi >= v;
        if (r.operator === 'lte' && typeof v === 'number') compatible = lo <= v;
        if (r.operator === 'between' && Array.isArray(v)) compatible = hi >= Number(v[0]) && lo <= Number(v[1]);
        if (compatible) {
          score += 2;
          reasons.push('Your age group may fit the age condition (to be confirmed)');
        } else score -= 5;
      }
    }

    if (touched.has(s.category_id)) {
      score += 1;
      reasons.push('Similar to services you viewed or saved');
    }

    if (score > 0) {
      const { rules: _r, documents: _d, steps: _s, sources: _so, category: _c, ...plain } = s;
      void _r; void _d; void _s; void _so; void _c;
      out.push({ service: plain, score, reasons });
    }
  }
  return out.sort((a, b) => b.score - a.score || a.service.name.localeCompare(b.service.name)).slice(0, limit);
}
