import { loadEnv } from './config/env.js';
import { createApp } from './app.js';
import { MemoryRepo } from './repositories/memoryRepo.js';
import { SupabaseAuthVerifier, SupabaseRepo } from './repositories/supabaseRepo.js';
import type { AuthVerifier } from './repositories/types.js';
import { logger } from './utils/logger.js';

const env = loadEnv();

let repo;
let verifier: AuthVerifier;
if (env.supabaseConfigured) {
  const sb = new SupabaseRepo(env.SUPABASE_URL as string, env.SUPABASE_SERVICE_ROLE_KEY as string);
  repo = sb;
  verifier = new SupabaseAuthVerifier(sb);
} else {
  if (env.NODE_ENV === 'production') {
    logger.error('Supabase is not configured; refusing to start in production');
    process.exit(1);
  }
  logger.warn('Supabase not configured: using in-memory demo data. Sign-in is disabled.');
  repo = new MemoryRepo();
  // No accounts exist without Supabase Auth, so every token is rejected.
  verifier = { verify: async () => null };
}

createApp(env, repo, verifier).listen(env.PORT, () => {
  logger.info('API listening', { port: env.PORT, supabase: env.supabaseConfigured, ai: env.aiConfigured });
});
