import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { CheckCircle2, CircleHelp, XCircle } from 'lucide-react';
import { api } from '../services/api';
import type { EligibilityResponse, ServiceDetail } from '../types';
import { useI18n } from '../i18n';
import { useAuth } from '../hooks/useAuth';
import { Button, ErrorBox, ExternalLink, Notice, PageContainer, Select, Spinner } from '../components/ui';
import { OCCUPATIONS, STATES, safeHref } from '../utils';
import type { MessageKey } from '../i18n/en';

type Answers = Record<string, string | number | boolean>;

function Question({ field, value, onChange }: { field: string; value: string; onChange: (v: string) => void }) {
  const num = (label: string, max: number) => (
    <div className="space-y-1"><label htmlFor="q-input" className="t-label block">{label}</label>
      <input id="q-input" inputMode="numeric" type="number" min={0} max={max} value={value} onChange={(e) => onChange(e.target.value)} className="w-full min-h-[44px]  border border-line-strong px-3" /></div>);
  switch (field) {
    case 'state_code': return <Select label="State / UT" value={value} onChange={(e) => onChange(e.target.value)}><option value="">—</option>{STATES.map(([c, n]) => <option key={c} value={c}>{n}</option>)}</Select>;
    case 'occupation': return <Select label="Current status" value={value} onChange={(e) => onChange(e.target.value)}><option value="">—</option>{OCCUPATIONS.map((o) => <option key={o} value={o}>{o}</option>)}</Select>;
    case 'age': return num('Age in years', 120);
    case 'annual_income': return num('Annual family income (INR)', 1_000_000_000);
    case 'disability': return <Select label="Do you have a recognised disability?" value={value} onChange={(e) => onChange(e.target.value)}><option value="">—</option><option value="true">Yes</option><option value="false">No</option></Select>;
    default: return <div className="space-y-1"><label htmlFor="q-input" className="t-label block">Your answer</label><input id="q-input" maxLength={50} value={value} onChange={(e) => onChange(e.target.value)} className="w-full min-h-[44px]  border border-line-strong px-3" /></div>;
  }
}

function toAnswers(raw: Record<string, string>): Answers {
  const out: Answers = {};
  for (const [k, v] of Object.entries(raw)) {
    if (v === '') continue;
    if (k === 'age' || k === 'annual_income') out[k] = Number(v);
    else if (k === 'disability') out[k] = v === 'true';
    else out[k] = v;
  }
  return out;
}

export default function Eligibility() {
  const { id = '' } = useParams();
  const { t } = useI18n();
  const { session } = useAuth();
  const [step, setStep] = useState(0);
  const [raw, setRaw] = useState<Record<string, string>>({});
  const [save, setSave] = useState(false);
  const svc = useQuery({ queryKey: ['service', id], queryFn: () => api<{ data: ServiceDetail }>(`/api/services/${id}`) });
  const evalM = useMutation({
    mutationFn: (s: ServiceDetail) => api<{ data: EligibilityResponse }>('/api/eligibility/evaluate', { method: 'POST', body: { service_id: s.id, answers: toAnswers(raw), save } }),
  });

  if (svc.isLoading) return <PageContainer><Spinner /></PageContainer>;
  if (svc.error || !svc.data) return <PageContainer><ErrorBox error={svc.error} onRetry={() => void svc.refetch()} /></PageContainer>;
  const s = svc.data.data;
  const qs = s.eligibility_questions;
  const result = evalM.data?.data;

  if (result) {
    const tone = result.outcome === 'likely_eligible' ? 'border-ok text-ok' : result.outcome === 'likely_not_eligible' ? 'border-danger text-danger' : 'border-caution text-caution';
    const Icon = result.outcome === 'likely_eligible' ? CheckCircle2 : result.outcome === 'likely_not_eligible' ? XCircle : CircleHelp;
    return (
      <PageContainer>
        <div className="grid gap-10 lg:grid-cols-12">
          <div className="space-y-8 lg:col-span-8">
            <header className="border-t border-line-strong pt-4">
              <p className="t-label text-grey-strong">{t('elig.result')}</p>
              <p className="mt-2 text-lg">{s.name}</p>
              <h1 role="status" className={`t-display mt-6 flex items-center gap-4 border-l-8 pl-5 text-display-lg ${tone}`}><Icon className="h-10 w-10 shrink-0" aria-hidden />{t(`elig.${result.outcome}` as MessageKey)}</h1>
            </header>
            <Notice tone="warn">{result.disclaimer}</Notice>
            {s.verification_status !== 'verified' && <Notice tone="warn">{t('status.hint.unverified')}</Notice>}
            <section className="border-t border-line pt-4"><h2 className="t-display text-display-sm">{t('elig.reasons')}</h2><ul className="mt-3 list-disc space-y-1 pl-5">{result.reasons.map((r, i) => <li key={i}>{r}</li>)}</ul></section>
            {result.missing_facts.length > 0 && <section className="border-t border-line pt-4"><h2 className="t-display text-display-sm">{t('elig.missing')}</h2><ul className="mt-3 list-disc space-y-1 pl-5">{result.missing_facts.map((r) => <li key={r}>{r}</li>)}</ul></section>}
            {result.guidance.length > 0 && <ul className="list-disc space-y-1 pl-5 text-grey-strong">{result.guidance.map((g, i) => <li key={i}>{g}</li>)}</ul>}
            {result.saved && <Notice tone="good">{t('elig.saved')}</Notice>}
          </div>
          <aside className="space-y-8 lg:col-span-4">
            <section className="border-t border-line-strong pt-4"><h2 className="t-label">{t('svc.documents')}</h2><ul className="mt-3 list-disc space-y-1 pl-5">{result.documents.map((d) => <li key={d.id}>{d.name}</li>)}</ul></section>
            <section className="border-t border-line-strong pt-4"><h2 className="t-label">{t('elig.confirm')}</h2><ul className="mt-3 space-y-2">{result.official_sources.map((x) => { const h = safeHref(x.url); return <li key={x.url}>{h ? <ExternalLink href={h}>{x.title}</ExternalLink> : x.title}</li>; })}</ul></section>
            <div className="flex flex-wrap items-center gap-4"><Button variant="secondary" onClick={() => { evalM.reset(); setStep(0); }}>{t('elig.back')}</Button><Link className="underline" to={`/services/${s.slug}`}>{s.name}</Link></div>
          </aside>
        </div>
      </PageContainer>
    );
  }

  if (qs.length === 0) return (
    <PageContainer narrow><h1 className="t-display text-display-lg">{t('elig.title')}</h1>
      <div className="mt-6"><Notice tone="warn">No eligibility conditions are recorded for this service yet. Please read the official criteria.</Notice></div>
      <Link className="mt-6 inline-block underline" to={`/services/${s.slug}`}>← {s.name}</Link></PageContainer>);

  const cur = qs[step]!;
  const last = step === qs.length - 1;
  return (
    <PageContainer narrow>
      <p className="t-label text-grey-strong">{t('elig.title')}</p>
      <h1 className="t-display mt-2 text-display-md">{s.name}</h1>
      <div className="mt-6"><Notice>{t('elig.disclaimer')}</Notice></div>
      <div className="mt-10">
        <p className="t-label" aria-live="polite">{t('elig.step')} {step + 1} {t('elig.of')} {qs.length}</p>
        <div className="mt-2 flex gap-1" role="progressbar" aria-valuemin={0} aria-valuemax={qs.length} aria-valuenow={step + 1}>
          {qs.map((_, i) => <div key={i} className={`h-1.5 flex-1 ${i <= step ? 'bg-ink' : 'bg-echo-3'}`} />)}
        </div>
      </div>
      <fieldset className="mt-10 space-y-4"><legend className="t-display text-display-md">{cur.question}</legend>
        {cur.explanation && <p className="text-grey-strong">{cur.explanation}</p>}
        <Question field={cur.field} value={raw[cur.field] ?? ''} onChange={(v) => setRaw({ ...raw, [cur.field]: v })} />
        <button type="button" className="text-sm underline" onClick={() => { setRaw({ ...raw, [cur.field]: '' }); if (last) evalM.mutate(s); else setStep(step + 1); }}>{t('elig.skip')}</button>
      </fieldset>
      {last && session && <label className="mt-6 flex items-center gap-3 text-sm"><input type="checkbox" className="h-5 w-5 accent-[#111]" checked={save} onChange={(e) => setSave(e.target.checked)} />{t('elig.saveSummary')}</label>}
      {evalM.error && <div className="mt-6"><ErrorBox error={evalM.error} /></div>}
      <div className="mt-10 flex gap-3">
        <Button variant="secondary" disabled={step === 0} onClick={() => setStep(step - 1)}>{t('elig.back')}</Button>
        {last ? <Button disabled={evalM.isPending} onClick={() => evalM.mutate(s)}>{t('elig.submit')}</Button> : <Button onClick={() => setStep(step + 1)}>{t('elig.next')}</Button>}
      </div>
    </PageContainer>
  );
}
