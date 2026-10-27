import Papa from 'papaparse';
import { z } from 'zod';
import type { Service } from '../types/index.js';
import { serviceWriteBody, type ServiceWrite } from '../validators/schemas.js';

export const MAX_CSV_BYTES = 512 * 1024;
export const MAX_CSV_ROWS = 500;

const csvRow = z.object({
  slug: z.string(),
  name: z.string(),
  short_description: z.string(),
  category_id: z.coerce.number().int(),
  government_level: z.string(),
  state_code: z.string().optional(),
  target_beneficiaries: z.string().optional(),
  tags: z.string().optional(),
  application_url: z.string().optional(),
  fees_text: z.string().optional(),
  important_dates_text: z.string().optional(),
  status: z.string().optional(),
  source_title: z.string().optional(),
  source_url: z.string().optional(),
});

const list = (s?: string) => (s ? s.split('|').map((x) => x.trim()).filter(Boolean) : []);

export interface CsvRowError {
  row: number;
  messages: string[];
}

/** Parses and validates a CSV. Returns all valid rows and per-row errors. Nothing is written here. */
export function parseServicesCsv(text: string): { rows: ServiceWrite[]; errors: CsvRowError[] } {
  if (Buffer.byteLength(text) > MAX_CSV_BYTES) throw new Error('CSV too large');
  const parsed = Papa.parse<Record<string, string>>(text, { header: true, skipEmptyLines: true });
  if (parsed.data.length > MAX_CSV_ROWS) throw new Error(`CSV has more than ${MAX_CSV_ROWS} rows`);
  const rows: ServiceWrite[] = [];
  const errors: CsvRowError[] = [];
  const seen = new Set<string>();
  parsed.data.forEach((raw, i) => {
    const rowNum = i + 2; // header is row 1
    const base = csvRow.safeParse(raw);
    if (!base.success) {
      errors.push({ row: rowNum, messages: base.error.issues.map((x) => `${x.path.join('.')}: ${x.message}`) });
      return;
    }
    const r = base.data;
    const candidate = {
      slug: r.slug.trim(),
      name: r.name.trim(),
      short_description: r.short_description.trim(),
      category_id: r.category_id,
      government_level: r.government_level.trim(),
      state_code: r.state_code?.trim() || null,
      target_beneficiaries: list(r.target_beneficiaries),
      tags: list(r.tags),
      application_url: r.application_url?.trim() || null,
      fees_text: r.fees_text?.trim() || null,
      important_dates_text: r.important_dates_text?.trim() || null,
      status: (r.status?.trim() || 'draft') as 'draft',
      sources: r.source_url?.trim() ? [{ title: r.source_title?.trim() || 'Official source', url: r.source_url.trim(), is_primary: true }] : undefined,
    };
    const v = serviceWriteBody.safeParse(candidate);
    if (!v.success) {
      errors.push({ row: rowNum, messages: v.error.issues.map((x) => `${x.path.join('.')}: ${x.message}`) });
      return;
    }
    if (v.data.government_level === 'state' && !v.data.state_code) {
      errors.push({ row: rowNum, messages: ['state_code: required for state services'] });
      return;
    }
    if (seen.has(v.data.slug)) {
      errors.push({ row: rowNum, messages: ['slug: duplicated within file'] });
      return;
    }
    seen.add(v.data.slug);
    rows.push(v.data);
  });
  return { rows, errors };
}

/** Prevent spreadsheet formula injection on export. */
function safeCell(v: unknown): string {
  const s = Array.isArray(v) ? v.join('|') : v == null ? '' : String(v);
  return /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
}

export function servicesToCsv(services: Service[]): string {
  const cols = ['slug', 'name', 'short_description', 'category_id', 'government_level', 'state_code', 'target_beneficiaries', 'tags', 'application_url', 'fees_text', 'important_dates_text', 'status', 'verification_status', 'last_verified_at'] as const;
  const data = services.map((s) => cols.map((c) => safeCell((s as unknown as Record<string, unknown>)[c])));
  return Papa.unparse({ fields: [...cols], data });
}
