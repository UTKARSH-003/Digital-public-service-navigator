import { loadEnv } from '../src/config/env.js';
import { createApp } from '../src/app.js';
import { MemoryRepo } from '../src/repositories/memoryRepo.js';
import type { AuthVerifier } from '../src/repositories/types.js';
import type { AuthUser } from '../src/types/index.js';

export const USERS: Record<string, AuthUser> = {
  'tok-user': { id: '11111111-1111-4111-8111-111111111111', role: 'user' },
  'tok-user2': { id: '22222222-2222-4222-8222-222222222222', role: 'user' },
  'tok-editor': { id: '33333333-3333-4333-8333-333333333333', role: 'content_admin' },
  'tok-reviewer': { id: '44444444-4444-4444-8444-444444444444', role: 'reviewer' },
  'tok-super': { id: '55555555-5555-4555-8555-555555555555', role: 'super_admin' },
};

export function makeApp(envOverrides: Record<string, string> = {}) {
  const env = loadEnv({ NODE_ENV: 'test', RATE_LIMIT_MAX: '10000', ...envOverrides } as NodeJS.ProcessEnv);
  const repo = new MemoryRepo();
  const verifier: AuthVerifier = { verify: async (t) => USERS[t] ?? null };
  return { app: createApp(env, repo, verifier), repo, env };
}

export const bearer = (t: string) => ({ Authorization: `Bearer ${t}` });
