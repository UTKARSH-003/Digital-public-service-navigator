import { useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Bookmark, ClipboardList, ListChecks } from 'lucide-react';
import { api } from '../services/api';
import type { ServiceDetail as Detail } from '../types';
import { useI18n } from '../i18n';
import { useAuth } from '../hooks/useAuth';
import { Button, ErrorBox, ExternalLink, LinkButton, Notice, PageContainer, Spinner, StatusBadge } from '../components/ui';
import { FeedbackForm } from '../components/FeedbackForm';
import { formatDate, safeHref } from '../utils';

function Block({ id, title, n, children }: { id: string; title: string; n: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="grid gap-4 border-t border-line-strong pt-5 lg:grid-cols-12 lg:gap-8">
      <div className="lg:col-span-4"><p className="t-label text-grey-strong">{n}</p><h2 id={id} className="t-display mt-1 text-display-sm">{title}</h2></div>
      <div className="lg:col-span-8">{children}</div>
    </section>
  );
}

export default function ServiceDetail() {
  const { id = '' } = useParams();
  const { t, lang, missing } = useI18n();
  const { session } = useAuth();
  const nav = useNavigate();
  const qc = useQueryClient();
  const [showReport, setShowReport] = useState(false);
  const q = useQuery({ queryKey: ['service', id], queryFn: () => api<{ data: Detail }>(`/api/services/${id}`) });
  const saved = useQuery({ enabled: Boolean(session), queryKey: ['saved'], queryFn: () => api<{ data: { id: string; service: { id: string } }[] }>('/api/user/saved-services') });
  const s = q.data?.data;
  const savedRow = saved.data?.data.find((x) => x.service.id === s?.id);

  const save = useMutation({
    mutationFn: async () => savedRow ? api(`/api/user/saved-services/${savedRow.id}`, { method: 'DELETE' }) : api('/api/user/saved-services', { method: 'POST', body: { service_id: s!.id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['saved'] }),
  });
  const checklist = useMutation({
    mutationFn: () => api('/api/user/checklists', { method: 'POST', body: { service_id: s!.id } }),
    onSuccess: () => nav(`/checklist/${s!.id}`),
  });

  if (q.isLoading) return <PageContainer><Spinner /></PageContainer>;
  if (q.error || !s) return <PageContainer><ErrorBox error={q.error ?? new Error('Service not found')} onRetry={() => void q.refetch()} /></PageContainer>;

  const requireLogin = (fn: () => void) => session ? fn() : nav('/login', { state: { from: `/services/${id}` } });
  const hasRules = s.rules.some((r) => r.mandatory);
  const primary = s.sources.find((x) => safeHref(x.url));
  const unverified = t('svc.unverified');

  return (
    <PageContainer>
      <article className="space-y-12">
        <header>
          <Link to="/services" className="t-label inline-flex items-center gap-2 hover:underline"><ArrowLeft className="h-4 w-4" aria-hidden />{t('nav.services')}</Link>
          <div className="mt-8 flex flex-wrap items-center gap-3"><StatusBadge status={s.verification_status} />
            <span className="t-label text-grey-strong">{s.category?.name_en} · {s.government_level === 'central' ? 'Central' : `State · ${s.state_code}`}</span></div>
          <h1 className="t-display mt-4 max-w-5xl text-display-xl">{s.name}</h1>
          <p className="mt-6 max-w-3xl text-xl">{s.short_description}</p>
          {lang === 'hi' && missing('svc.about') && <p className="mt-3 text-sm text-grey-strong">{t('svc.translation')}</p>}
          {s.verification_status !== 'verified' && <div className="mt-6 max-w-3xl"><Notice tone="warn">{t('status.hint.unverified')}</Notice></div>}
          <p className="t-label mt-5 text-grey-strong">{t('svc.lastVerified')}: {s.last_verified_at ? formatDate(s.last_verified_at) : t('svc.neverVerified')}</p>
          <div className="no-print mt-8 flex flex-wrap gap-3">
            <LinkButton to={`/services/${s.slug}/eligibility`}><ListChecks className="h-4 w-4" aria-hidden />{t('svc.check')}</LinkButton>
            {primary && <a href={primary.url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-[48px] items-center gap-2 rounded-full border border-dark px-6 text-sm font-bold uppercase tracking-[0.06em] transition-colors duration-fast hover:bg-dark hover:text-paper">{primary.title}<span className="sr-only"> (official source, opens in a new tab)</span></a>}
            <Button variant="secondary" onClick={() => requireLogin(() => save.mutate())} disabled={save.isPending}><Bookmark className="h-4 w-4" aria-hidden />{savedRow ? t('svc.saved') : t('svc.save')}</Button>
            <Button variant="secondary" onClick={() => requireLogin(() => checklist.mutate())} disabled={checklist.isPending}><ClipboardList className="h-4 w-4" aria-hidden />{t('svc.checklist')}</Button>
          </div>
          {(save.error || checklist.error) && <div className="mt-4"><ErrorBox error={save.error ?? checklist.error} /></div>}
        </header>

        <Block id="el" n="01" title={t('svc.eligibility')}>
          {s.rules.length ? <ul className="space-y-3">{s.rules.map((r) => <li key={r.id} className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line pb-3"><span>{r.description}</span><span className="t-label text-grey-strong">{r.mandatory ? t('svc.mandatory') : t('svc.info')}</span></li>)}</ul>
            : <p className="text-grey-strong">Information not verified.</p>}
          {!hasRules && <p className="mt-3 text-sm text-grey-strong">No required conditions are recorded, so the checker can only show “insufficient information”.</p>}
        </Block>

        <Block id="docs" n="02" title={t('svc.documents')}>
          {s.documents.length ? <ul className="space-y-3">{s.documents.map((d) => <li key={d.id} className="border-b border-line pb-3"><span className="font-bold">{d.name}</span>{d.notes ? <span className="text-grey-strong"> — {d.notes}</span> : ''}{!d.is_mandatory && <span className="t-label ml-2 text-grey-strong">optional</span>}</li>)}</ul>
            : <p className="text-grey-strong">Information not verified.</p>}
        </Block>

        <Block id="steps" n="03" title={t('svc.steps')}>
          {s.steps.length ? <ol className="space-y-4">{s.steps.map((x) => <li key={x.id} className="grid grid-cols-[2.5rem_1fr] gap-2 border-b border-line pb-4"><span className="t-display text-display-sm text-grey">{String(x.step_number).padStart(2, '0')}</span><div><p className="font-bold">{x.title}</p>{x.details && <p className="mt-1 text-grey-strong">{x.details}</p>}</div></li>)}</ol>
            : <p className="text-grey-strong">Information not verified.</p>}
        </Block>

        <Block id="src" n="04" title={t('svc.sources')}>
          {s.sources.length ? <ul className="space-y-2">{s.sources.map((x) => { const h = safeHref(x.url); return <li key={x.id}>{h ? <ExternalLink href={h}>{x.title}</ExternalLink> : x.title}</li>; })}</ul>
            : <p className="text-grey-strong">Information not verified: no official source is recorded yet.</p>}
          {safeHref(s.application_url) && <p className="mt-4">Application page: <ExternalLink href={s.application_url!}>{s.application_url}</ExternalLink></p>}
          <dl className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="border-t border-line pt-3"><dt className="t-label text-grey-strong">{t('svc.fees')}</dt><dd>{s.fees_text ? `${s.fees_text}${s.fees_verified ? '' : ` (${unverified})`}` : unverified}</dd></div>
            <div className="border-t border-line pt-3"><dt className="t-label text-grey-strong">{t('svc.dates')}</dt><dd>{s.important_dates_text ? `${s.important_dates_text}${s.dates_verified ? '' : ` (${unverified})`}` : unverified}</dd></div>
          </dl>
        </Block>

        <section className="no-print border-t border-line-strong pt-5">
          <Button variant="ghost" aria-expanded={showReport} onClick={() => setShowReport(!showReport)}>{t('svc.report')}</Button>
          {showReport && <div className="mt-4 max-w-xl"><FeedbackForm serviceId={s.id} /></div>}
        </section>
      </article>
    </PageContainer>
  );
}
