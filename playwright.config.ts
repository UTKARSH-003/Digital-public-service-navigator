import { defineConfig } from '@playwright/test';

// Runs against the real backend in in-memory demo mode (no Supabase env vars) and the Vite dev server.
export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  retries: 0,
  use: {
    baseURL: 'http://localhost:5173',
    ...(process.env.PW_CHROMIUM ? { launchOptions: { executablePath: process.env.PW_CHROMIUM } } : {}),
  },
  webServer: [
    { command: 'npm run dev --prefix backend', url: 'http://localhost:4000/health', reuseExistingServer: true, timeout: 60_000,
      env: { PORT: '4000', CORS_ORIGINS: 'http://localhost:5173', SUPABASE_URL: '', SUPABASE_SERVICE_ROLE_KEY: '' } },
    { command: 'npm run dev --prefix frontend', url: 'http://localhost:5173', reuseExistingServer: true, timeout: 60_000,
      env: { VITE_API_BASE_URL: 'http://localhost:4000', VITE_SUPABASE_URL: '', VITE_SUPABASE_ANON_KEY: '' } },
  ],
});
