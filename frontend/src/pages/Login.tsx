import { useState, type FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useI18n } from '../i18n';
import { useAuth } from '../hooks/useAuth';
import { Button, Field, Notice, PageContainer, PageTitle } from '../components/ui';

export default function Login() {
  const { t } = useI18n();
  const { configured, session, signIn, signUp } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const from = (loc.state as { from?: string } | null)?.from ?? '/dashboard';
  const [mode, setMode] = useState<'in' | 'up'>('in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState(false);

  if (session) return <Navigate to={from} replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault(); setErr(''); setInfo('');
    if (password.length < 8) { setErr('Password must be at least 8 characters.'); return; }
    setBusy(true);
    const error = mode === 'in' ? await signIn(email, password) : await signUp(email, password);
    setBusy(false);
    if (error) setErr(error === 'not_configured' ? t('auth.notconfigured') : error);
    else if (mode === 'up') setInfo(t('auth.checkemail'));
    else nav(from, { replace: true });
  };

  return (
    <PageContainer narrow><div className="max-w-md">
      <PageTitle eyebrow={t('nav.signin')}>{mode === 'in' ? t('auth.signin') : t('auth.signup')}</PageTitle>
      {!configured && <div className="mb-4"><Notice tone="warn">{t('auth.notconfigured')}</Notice></div>}
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field label={t('auth.email')} type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <Field label={t('auth.password')} type="password" autoComplete={mode === 'in' ? 'current-password' : 'new-password'} required value={password} onChange={(e) => setPassword(e.target.value)} hint="At least 8 characters." />
        {err && <p role="alert" className="text-sm text-danger">{err}</p>}
        {info && <Notice tone="good">{info}</Notice>}
        <Button type="submit" disabled={busy || !configured} className="w-full">{mode === 'in' ? t('auth.signin') : t('auth.signup')}</Button>
      </form>
      <button className="mt-4 text-sm underline" onClick={() => { setMode(mode === 'in' ? 'up' : 'in'); setErr(''); setInfo(''); }}>{mode === 'in' ? t('auth.switch.signup') : t('auth.switch.signin')}</button>
    </div></PageContainer>
  );
}
