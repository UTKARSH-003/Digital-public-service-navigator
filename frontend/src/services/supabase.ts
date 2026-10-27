import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** null when Supabase env vars are placeholders/missing: the app still works for anonymous use. */
export const supabase =
  url && key && !url.includes('your-project-ref') && !key.startsWith('replace-with')
    ? createClient(url, key)
    : null;
