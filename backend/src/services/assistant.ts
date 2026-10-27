import type { Env } from '../config/env.js';
import type { ServiceDetail } from '../types/index.js';
import { logger } from '../utils/logger.js';

export interface Citation {
  service_id: string;
  title: string;
  url: string;
  verification_status: string;
}

export interface AssistantReply {
  answer: string;
  intent: string;
  mode: 'fallback' | 'ai';
  services: { id: string; slug: string; name: string; short_description: string; verification_status: string }[];
  citations: Citation[];
  clarifying_question: string | null;
  related: { id: string; name: string }[];
  verified: boolean;
  notice: string;
}

export const NOT_VERIFIED = 'Information not verified';

const SENSITIVE = /\b(otp|password|pin|cvv|aadhaar\s*(number|otp)|one[-\s]?time\s*password)\b/i;

const STOP = new Set(['i', 'a', 'an', 'the', 'for', 'to', 'of', 'in', 'on', 'my', 'me', 'can', 'do', 'how', 'what', 'which', 'is', 'are', 'and', 'or', 'need', 'apply', 'get', 'find', 'want', 'with', 'about', 'explain', 'this', 'that', 'scheme', 'service', 'services', 'documents', 'document']);

export function detectIntent(msg: string): string {
  const m = msg.toLowerCase();
  if (/document|papers|required|proof/.test(m)) return 'documents';
  if (/eligib|qualify|can i get|am i/.test(m)) return 'eligibility';
  if (/how (do|to|can)|apply|procedure|steps|process/.test(m)) return 'how_to_apply';
  if (/explain|simple|meaning|what is/.test(m)) return 'explain';
  return 'discover';
}

export function tokenize(msg: string): string[] {
  return msg
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((t) => t.length > 2 && !STOP.has(t));
}

const SYNONYMS: Record<string, string[]> = {
  scholarship: ['scholarship', 'student', 'education', 'fees'],
  scholarships: ['scholarship', 'student', 'education'],
  student: ['student', 'scholarship'],
  farmer: ['farmer', 'agriculture', 'kisan'],
  farming: ['farmer', 'agriculture'],
  pension: ['pension', 'senior citizen', 'old age'],
  business: ['business', 'msme', 'entrepreneur', 'registration'],
  certificate: ['certificate', 'document'],
  job: ['job', 'skill', 'training'],
  jobs: ['job', 'skill', 'training'],
  skill: ['skill', 'training'],
};

export function retrieve(services: ServiceDetail[], msg: string, limit = 3) {
  const terms = [...new Set(tokenize(msg).flatMap((t) => SYNONYMS[t] ?? [t]))];
  if (!terms.length) return [];
  return services
    .map((s) => {
      const name = s.name.toLowerCase();
      const tags = s.tags.map((t) => t.toLowerCase());
      const desc = s.short_description.toLowerCase();
      let score = 0;
      for (const t of terms) {
        if (name.includes(t)) score += 3;
        if (tags.some((x) => x.includes(t))) score += 2;
        if (desc.includes(t)) score += 1;
      }
      return { s, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.s);
}

function primarySource(s: ServiceDetail) {
  return s.sources.find((x) => x.is_primary) ?? s.sources[0] ?? null;
}

function statusNote(s: ServiceDetail) {
  return s.verification_status === 'verified'
    ? 'verified'
    : `${s.verification_status.replace('_', ' ')} (not yet verified by a reviewer)`;
}

/** Deterministic answer assembled only from stored record fields. */
export function buildFallbackAnswer(intent: string, matches: ServiceDetail[]): string {
  const lines: string[] = [];
  for (const s of matches) {
    lines.push(`**${s.name}** — status: ${statusNote(s)}.`);
    lines.push(s.short_description);
    if (intent === 'documents') {
      lines.push(
        s.documents.length
          ? `Documents listed in our record: ${s.documents.map((d) => d.name).join('; ')}. Confirm the final list on the official source.`
          : `Documents: ${NOT_VERIFIED}.`,
      );
    } else if (intent === 'how_to_apply') {
      lines.push(
        s.steps.length
          ? `Steps: ${s.steps.map((x) => `${x.step_number}. ${x.title}`).join(' ')}`
          : `Application steps: ${NOT_VERIFIED}.`,
      );
    } else if (intent === 'eligibility') {
      lines.push(
        s.rules.some((r) => r.mandatory)
          ? 'Use the eligibility checker on the service page for a preliminary indication.'
          : `Eligibility rules: ${NOT_VERIFIED}.`,
      );
    }
    const src = primarySource(s);
    lines.push(src ? `Official source: ${src.title} (${src.url})` : `Official source: ${NOT_VERIFIED}.`);
    lines.push('');
  }
  return lines.join('\n').trim();
}

async function callLlm(env: Env, question: string, matches: ServiceDetail[], language: string): Promise<string | null> {
  if (!env.aiConfigured || !env.AI_API_KEY || !env.AI_MODEL) return null;
  const context = matches
    .map(
      (s, i) =>
        `[${i + 1}] ${s.name}\nStatus: ${s.verification_status}\nSummary: ${s.short_description}\nDocuments: ${s.documents.map((d) => d.name).join(', ') || 'not recorded'}\nSteps: ${s.steps.map((x) => x.title).join(' > ') || 'not recorded'}\nOfficial source: ${primarySource(s)?.url ?? 'not recorded'}`,
    )
    .join('\n\n');
  const system = `You explain Indian public services in plain ${language === 'hi' ? 'Hindi' : 'English'}. Use ONLY the records provided. Never invent eligibility rules, deadlines, fees, benefits or URLs. If a fact is not in the records, say "${NOT_VERIFIED}". Cite records as [n]. Never ask for passwords, OTPs or Aadhaar numbers.`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), env.AI_TIMEOUT_MS);
  try {
    let res: Response;
    if (env.AI_PROVIDER === 'anthropic') {
      res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        signal: ctrl.signal,
        headers: { 'content-type': 'application/json', 'x-api-key': env.AI_API_KEY, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model: env.AI_MODEL, max_tokens: 600, system, messages: [{ role: 'user', content: `Records:\n${context}\n\nQuestion: ${question}` }] }),
      });
      if (!res.ok) return null;
      const j = (await res.json()) as { content?: { text?: string }[] };
      return j.content?.[0]?.text?.trim() || null;
    }
    res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      signal: ctrl.signal,
      headers: { 'content-type': 'application/json', authorization: `Bearer ${env.AI_API_KEY}` },
      body: JSON.stringify({ model: env.AI_MODEL, max_tokens: 600, messages: [{ role: 'system', content: system }, { role: 'user', content: `Records:\n${context}\n\nQuestion: ${question}` }] }),
    });
    if (!res.ok) return null;
    const j = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    return j.choices?.[0]?.message?.content?.trim() || null;
  } catch (e) {
    logger.warn('ai call failed, using fallback', { reason: e instanceof Error ? e.name : 'unknown' });
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function answerQuery(
  env: Env,
  services: ServiceDetail[],
  message: string,
  opts: { language: 'en' | 'hi'; state?: string; aiAllowed: boolean },
): Promise<AssistantReply> {
  const notice =
    'Independent information service, not an official government site. Always confirm details on the official source.';

  if (SENSITIVE.test(message)) {
    return {
      answer: 'Please never share passwords, OTPs, PINs or Aadhaar authentication codes with anyone, including this assistant. I do not need them and cannot access government records. Ask me about a scheme or document instead.',
      intent: 'sensitive_data_warning', mode: 'fallback', services: [], citations: [], clarifying_question: null, related: [], verified: false, notice,
    };
  }

  const intent = detectIntent(message);
  let pool = services;
  if (opts.state) pool = pool.filter((s) => s.government_level === 'central' || s.state_code === opts.state);
  const matches = retrieve(pool, message);

  if (!matches.length) {
    return {
      answer: `${NOT_VERIFIED}: I could not find a matching service in the approved records.`,
      intent, mode: 'fallback', services: [], citations: [],
      clarifying_question: 'Which topic are you interested in (for example scholarships, pension, farming, business or certificates), and which state do you live in?',
      related: [], verified: false, notice,
    };
  }

  const citations: Citation[] = matches.flatMap((s) => {
    const src = primarySource(s);
    return src ? [{ service_id: s.id, title: src.title, url: src.url, verification_status: s.verification_status }] : [];
  });

  let answer = buildFallbackAnswer(intent, matches);
  let mode: 'fallback' | 'ai' = 'fallback';
  if (opts.aiAllowed) {
    const ai = await callLlm(env, message, matches, opts.language);
    if (ai) {
      answer = ai;
      mode = 'ai';
    }
  }

  const matchIds = new Set(matches.map((m) => m.id));
  const related = services
    .filter((s) => !matchIds.has(s.id) && matches.some((m) => m.category_id === s.category_id))
    .slice(0, 3)
    .map((s) => ({ id: s.id, name: s.name }));

  const verified = matches.every((m) => m.verification_status === 'verified');
  return {
    answer, intent, mode,
    services: matches.map((s) => ({ id: s.id, slug: s.slug, name: s.name, short_description: s.short_description, verification_status: s.verification_status })),
    citations,
    clarifying_question: !opts.state && matches.some((m) => m.government_level === 'state') ? 'Which state do you live in? Rules differ by state.' : null,
    related, verified, notice,
  };
}
