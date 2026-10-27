import { useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Printer } from 'lucide-react';
import { api } from '../services/api';
import type { ChecklistItem } from '../types';
import { useI18n } from '../i18n';
import { Button, ErrorBox, Field, Notice, PageContainer, PageTitle, Spinner } from '../components/ui';

export default function Checklist() {
  const { serviceId = '' } = useParams();
  const { t } = useI18n();
  const qc = useQueryClient();
  const key = ['checklist', serviceId];
  const q = useQuery({ queryKey: key, queryFn: () => api<{ data: ChecklistItem[] }>(`/api/user/checklists?service_id=${serviceId}`) });
  const [ref, setRef] = useState<string | null>(null);
  const [custom, setCustom] = useState('');
  const patch = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) => api(`/api/user/checklists/${id}`, { method: 'PATCH', body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });
  const create = useMutation({ mutationFn: (items: string[]) => api('/api/user/checklists', { method: 'POST', body: { service_id: serviceId, custom_items: items } }), onSuccess: () => qc.invalidateQueries({ queryKey: key }) });

  if (q.isLoading) return <PageContainer><Spinner /></PageContainer>;
  if (q.error) return <PageContainer><ErrorBox error={q.error} onRetry={() => void q.refetch()} /></PageContainer>;
  const items = q.data?.data ?? [];
  const savedRef = items.find((i) => i.application_reference)?.application_reference ?? '';
  const group = (type: string) => items.filter((i) => i.item_type === type);
  const done = items.filter((i) => i.is_done).length;

  const Section = ({ title, rows }: { title: string; rows: ChecklistItem[] }) => rows.length === 0 ? null : (
    <section><h2 className="t-display mb-2 border-t border-line-strong pt-3 text-display-sm">{title}</h2>
      <ul>{rows.map((i) => (
        <li key={i.id} className="border-t border-line py-2"><label className="flex min-h-[44px] items-center gap-3">
          <input type="checkbox" className="h-5 w-5 accent-[#111]" checked={i.is_done} onChange={(e) => patch.mutate({ id: i.id, body: { is_done: e.target.checked } })} />
          <span className={i.is_done ? 'text-grey-strong line-through' : ''}>{i.label}</span></label></li>))}</ul></section>);

  return (
    <PageContainer narrow className="space-y-6">
      <PageTitle eyebrow="Checklist">{t('check.title')}</PageTitle>
      <Notice>{t('check.note')}</Notice>
      <p className="text-sm" aria-live="polite">{done}/{items.length} done</p>
      {items.length === 0 && <div><p className="mb-2">No checklist yet for this service.</p><Button onClick={() => create.mutate([])}>{t('svc.checklist')}</Button></div>}
      <Section title={t('svc.documents')} rows={group('document')} />
      <Section title={t('svc.steps')} rows={group('step')} />
      <Section title="Your own items" rows={group('custom')} />
      {items.length > 0 && <>
        <form className="no-print flex items-end gap-2" onSubmit={(e: FormEvent) => { e.preventDefault(); const v = custom.trim(); if (v) { create.mutate([v]); setCustom(''); } }}>
          <div className="flex-1"><Field label={t('check.add')} value={custom} maxLength={300} onChange={(e) => setCustom(e.target.value)} /></div>
          <Button type="submit" variant="secondary" disabled={create.isPending || !custom.trim()}>+</Button>
        </form>
        <form className="no-print flex items-end gap-2" onSubmit={(e) => { e.preventDefault(); const v = ref ?? savedRef; const first = items[0]; if (first) patch.mutate({ id: first.id, body: { application_reference: v } }); }}>
          <div className="flex-1"><Field label={t('check.reference')} value={ref ?? savedRef} maxLength={64} onChange={(e) => setRef(e.target.value)} hint="Letters, digits and - / _ . only. Never enter OTPs or passwords." /></div>
          <Button type="submit" variant="secondary" disabled={patch.isPending}>{t('check.save')}</Button>
        </form>
        {patch.error && <ErrorBox error={patch.error} />}
        {savedRef && <p className="text-sm">Reference: <strong>{savedRef}</strong></p>}
        <div className="no-print flex gap-3"><Button variant="secondary" onClick={() => window.print()}><Printer className="h-4 w-4" aria-hidden />{t('check.print')}</Button><Link className="self-center underline" to="/dashboard">{t('nav.dashboard')}</Link></div>
      </>}
    </PageContainer>
  );
}
