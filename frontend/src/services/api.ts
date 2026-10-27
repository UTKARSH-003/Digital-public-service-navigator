import { supabase } from './supabase';

const BASE = ((import.meta.env.VITE_API_BASE_URL as string | undefined) ?? 'http://localhost:4000').replace(/\/$/, '');

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string, public details?: unknown) {
    super(message);
  }
}

async function token(): Promise<string | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

export async function api<T>(path: string, opts: { method?: string; body?: unknown; raw?: string; contentType?: string } = {}): Promise<T> {
  const headers: Record<string, string> = {};
  const t = await token();
  if (t) headers.Authorization = `Bearer ${t}`;
  let body: string | undefined;
  if (opts.raw !== undefined) {
    body = opts.raw;
    headers['Content-Type'] = opts.contentType ?? 'text/csv';
  } else if (opts.body !== undefined) {
    body = JSON.stringify(opts.body);
    headers['Content-Type'] = 'application/json';
  }
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, { method: opts.method ?? 'GET', headers, body });
  } catch {
    throw new ApiError(0, 'network', 'Cannot reach the server. Check your connection and try again.');
  }
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  let json: unknown = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* non-JSON (e.g. CSV) */ }
  if (!res.ok) {
    const e = (json as { error?: { code?: string; message?: string; details?: unknown } } | null)?.error;
    throw new ApiError(res.status, e?.code ?? 'error', e?.message ?? 'Request failed', e?.details);
  }
  return (json ?? text) as T;
}

export const qs = (params: Record<string, string | number | undefined>) => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '') p.set(k, String(v));
  const s = p.toString();
  return s ? `?${s}` : '';
};
