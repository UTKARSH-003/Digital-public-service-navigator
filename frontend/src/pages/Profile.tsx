import { useEffect, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, Trash2 } from 'lucide-react';
import { api } from '../services/api';
import { useI18n } from '../i18n';
import { useAuth } from '../hooks/useAuth';
import { Button, ErrorBox, Field, Notice, PageContainer, PageTitle, Select, Spinner } from '../components/ui';
import { OCCUPATIONS, STATES } from '../utils';

interface Prefs { profiling_consent: boolean; state_code?: string | null; age_group?: string | null; occupation?: string | null; interests?: string[] }

export default function Profile() {
  const { t } = useI18n();
  const { signOut } = useAuth();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['prefs'], queryFn: () => api<{ data: Prefs | null }>('/api/user/preferences') });
  const [consent, setConsent] = useState(false);
  const [state, setState] = useState('');
  const [age, setAge] = useState('');
  const [occ, setOcc] = useState('');
  const [interests, setInterests] = useState('');

  useEffect(() => {
    const p = q.data?.data;
    if (p) { setConsent(p.profiling_consent); setState(p.state_code ?? ''); setAge(p.age_group ?? ''); setOcc(p.occupation ?? ''); setInterests((p.interests ?? []).join(', ')); }
  }, [q.data]);

  const save = useMutation({
    mutationFn: () => api('/api/user/preferences', { method: 'PUT', body: consent
      ? { profiling_consent: true, state_code: state || null, age_group: age || null, occupation: occ || null, interests: interests.split(',').map((s) => s.trim()).filter(Boolean).slice(0, 12) }
      : { profiling_consent: false } }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['prefs'] }); void qc.invalidateQueries({ queryKey: ['recs'] }); },
  });
  const exportData = useMutation({
    mutationFn: () => api<{ data: unknown }>('/api/user/export'),
    onSuccess: (r) => {
      const url = URL.createObjectURL(new Blob([JSON.stringify(r.data, null, 2)], { type: 'application/json' }));
      const a = document.createElement('a'); a.href = url; a.download = 'my-data.json'; a.click(); URL.revokeObjectURL(url);
    },
  });
  const del = useMutation({ mutationFn: () => api('/api/user/account', { method: 'DELETE' }), onSuccess: () => void signOut() });

  if (q.isLoading) return <PageContainer><Spinner /></PageContainer>;
  if (q.error) return <PageContainer><ErrorBox error={q.error} onRetry={() => void q.refetch()} /></PageContainer>;

  return (
    <PageContainer narrow className="space-y-12">
      <PageTitle eyebrow="Account">{t('profile.title')}</PageTitle>
      <form onSubmit={(e: FormEvent) => { e.preventDefault(); save.mutate(); }} className="space-y-4">
        <label className="flex items-start gap-3"><input type="checkbox" className="mt-1 h-5 w-5 accent-[#111]" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
          <span><span className="font-medium">{t('profile.consent')}</span><span className="block text-sm text-grey-strong">{t('profile.consent.hint')}</span></span></label>
        <fieldset disabled={!consent} className="space-y-4 disabled:opacity-50">
          <Select label={t('profile.state')} value={state} onChange={(e) => setState(e.target.value)}><option value="">—</option>{STATES.map(([c, n]) => <option key={c} value={c}>{n}</option>)}</Select>
          <Select label={t('profile.age')} value={age} onChange={(e) => setAge(e.target.value)}><option value="">—</option>{['under_18', '18_25', '26_40', '41_59', '60_plus'].map((a) => <option key={a} value={a}>{a.replace('_', '–').replace('plus', '+')}</option>)}</Select>
          <Select label={t('profile.occupation')} value={occ} onChange={(e) => setOcc(e.target.value)}><option value="">—</option>{OCCUPATIONS.map((o) => <option key={o} value={o}>{o}</option>)}</Select>
          <Field label={t('profile.interests')} value={interests} onChange={(e) => setInterests(e.target.value)} maxLength={200} />
        </fieldset>
        {save.error && <ErrorBox error={save.error} />}
        {save.isSuccess && <Notice tone="good">Saved.</Notice>}
        <Button type="submit" disabled={save.isPending}>{t('profile.save')}</Button>
      </form>

      <section className="space-y-3 border-t border-line pt-6">
        <h2 className="t-display text-display-sm">Your data</h2>
        <p className="text-sm text-grey-strong">We store saved services, checklist items, eligibility result summaries (never your answers) and the optional preferences above. Delete your account at any time to remove them.</p>
        <Button variant="secondary" onClick={() => exportData.mutate()} disabled={exportData.isPending}><Download className="h-4 w-4" aria-hidden />{t('profile.export')}</Button>
        {exportData.error && <ErrorBox error={exportData.error} />}
        <div><Button variant="danger" disabled={del.isPending} onClick={() => { if (window.confirm(t('profile.delete.confirm'))) del.mutate(); }}><Trash2 className="h-4 w-4" aria-hidden />{t('profile.delete')}</Button></div>
        {del.error && <ErrorBox error={del.error} />}
      </section>
    </PageContainer>
  );
}
