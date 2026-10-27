import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import type { ChecklistItem, Outcome, Recommendation, Service } from '../types';
import { useI18n } from '../i18n';
import type { MessageKey } from '../i18n/en';
import { Button, Empty, ErrorBox, PageContainer, PageTitle, Spinner, StatusBadge } from '../components/ui';
import { formatDate } from '../utils';

export default function Dashboard() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const saved = useQuery({ queryKey: ['saved'], queryFn: () => api<{ data: { id: string; service: Service }[] }>('/api/user/saved-services') });
  const recs = useQuery({ queryKey: ['recs'], queryFn: () => api<{ data: Recommendation[]; meta: { personalised: boolean } }>('/api/recommendations') });
  const assess = useQuery({ queryKey: ['assessments'], queryFn: () => api<{ data: { id: string; service_id: string; outcome: Outcome; created_at: string }[] }>('/api/user/assessments') });
  const lists = useQuery({ queryKey: ['checklists'], queryFn: () => api<{ data: ChecklistItem[] }>('/api/user/checklists') });
  const remove = useMutation({ mutationFn: (id: string) => api(`/api/user/saved-services/${id}`, { method: 'DELETE' }), onSuccess: () => qc.invalidateQueries({ queryKey: ['saved'] }) });

  const byService = new Map<string, ChecklistItem[]>();
  for (const i of lists.data?.data ?? []) byService.set(i.service_id, [...(byService.get(i.service_id) ?? []), i]);
  const names = new Map((saved.data?.data ?? []).map((s) => [s.service.id, s.service] as const));
  (recs.data?.data ?? []).forEach((r) => names.set(r.service.id, r.service));

  return (
    <PageContainer className="space-y-14">
      <PageTitle eyebrow="Account">{t('dash.title')}</PageTitle>
      <section aria-labelledby="saved"><h2 id="saved" className="t-display mb-3 border-t border-line-strong pt-3 text-display-sm">{t('dash.saved')}</h2>
        {saved.isLoading ? <Spinner /> : saved.error ? <ErrorBox error={saved.error} onRetry={() => void saved.refetch()} /> :
          saved.data?.data.length ? <ul>{saved.data.data.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 border-t border-line py-3">
              <div><Link className="font-semibold text-ink underline" to={`/services/${s.service.slug}`}>{s.service.name}</Link> <StatusBadge status={s.service.verification_status} /></div>
              <Button variant="ghost" onClick={() => remove.mutate(s.id)} aria-label={`${t('dash.remove')}: ${s.service.name}`}>{t('dash.remove')}</Button>
            </li>))}</ul> : <Empty title={t('dash.none.saved')} action={<Link className="underline" to="/services">{t('nav.services')}</Link>} />}
      </section>

      <section aria-labelledby="recs"><h2 id="recs" className="t-display mb-3 border-t border-line-strong pt-3 text-display-sm">{t('dash.recs')}</h2>
        {recs.isLoading ? <Spinner /> : recs.error ? <ErrorBox error={recs.error} /> : (
          <>
            {!recs.data?.meta.personalised && <p className="mb-2 text-sm text-grey-strong">{t('dash.recs.none')} <Link className="underline" to="/profile">{t('profile.title')}</Link></p>}
            <ul>{recs.data?.data.map((r) => (
              <li key={r.service.id} className="border-t border-line py-3">
                <Link className="font-semibold text-ink underline" to={`/services/${r.service.slug}`}>{r.service.name}</Link>
                <p className="text-sm text-grey-strong">Why: {r.reasons.join('; ')}.</p></li>))}</ul>
          </>)}
      </section>

      <section aria-labelledby="chk"><h2 id="chk" className="t-display mb-3 border-t border-line-strong pt-3 text-display-sm">{t('dash.checklists')}</h2>
        {byService.size === 0 ? <Empty title="No checklists yet" hint="Open a service and choose “Create my checklist”." /> :
          <ul>{[...byService.entries()].map(([sid, items]) => (
            <li key={sid} className="border-t border-line py-3"><Link className="font-semibold text-ink underline" to={`/checklist/${sid}`}>{names.get(sid)?.name ?? 'Checklist'}</Link>
              <span className="ml-2 text-sm text-grey-strong">{items.filter((i) => i.is_done).length}/{items.length} done</span></li>))}</ul>}
      </section>

      <section aria-labelledby="as"><h2 id="as" className="t-display mb-3 border-t border-line-strong pt-3 text-display-sm">{t('dash.assessments')}</h2>
        {assess.data?.data.length ? <ul>{assess.data.data.map((a) => <li key={a.id} className="border-t border-line py-2 text-sm">{t(`elig.${a.outcome}` as MessageKey)} · {formatDate(a.created_at)}</li>)}</ul> : <p className="text-grey-strong">—</p>}
      </section>
    </PageContainer>
  );
}
