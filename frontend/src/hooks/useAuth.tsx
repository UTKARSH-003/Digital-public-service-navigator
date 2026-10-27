import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../services/supabase';
import { api } from '../services/api';
import type { RoleName } from '../types';

interface AuthState {
  configured: boolean;
  loading: boolean;
  session: Session | null;
  role: RoleName;
  signIn: (email: string, password: string) => Promise<string | null>;
  signUp: (email: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(Boolean(supabase));
  const [role, setRole] = useState<RoleName>('user');

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setLoading(false); });
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  // The role is only used to show/hide navigation. The backend enforces it on every admin request.
  useEffect(() => {
    if (!session) { setRole('user'); return; }
    let cancelled = false;
    api<{ data: { role: RoleName } }>('/api/me')
      .then((r) => r.data.role)
      .catch(() => 'user' as RoleName)
      .then((r) => { if (!cancelled) setRole(r); });
    return () => { cancelled = true; };
  }, [session]);

  const value = useMemo<AuthState>(() => ({
    configured: Boolean(supabase), loading, session, role,
    async signIn(email, password) {
      if (!supabase) return 'not_configured';
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      return error ? error.message : null;
    },
    async signUp(email, password) {
      if (!supabase) return 'not_configured';
      const { error } = await supabase.auth.signUp({ email, password });
      return error ? error.message : null;
    },
    async signOut() { await supabase?.auth.signOut(); },
  }), [loading, session, role]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthState {
  const c = useContext(Ctx);
  if (!c) throw new Error('useAuth must be used inside AuthProvider');
  return c;
}
