import { useState, type ChangeEvent } from 'react';
import { Link, NavLink, Route, Routes } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Download, Upload } from 'lucide-react';
import { api, ApiError, qs } from '../services/api';
import type { Paged, Service, VerificationStatus } from '../types';
import { useI18n } from '../i18n';
import { Button, Empty, ErrorBox, LinkButton, Notice, PageContainer, Select, Spinner, StatusBadge } from '../components/ui';
import { formatDate } from '../utils';
import ServiceEditor from './ServiceEditor';

const tab = ({ isActive }: { isActive: boolean }) => `t-label border px-4 py-2.5 text-[0.75rem] transition-colors duration-fast ${isActive ? 'border-dark bg-dark text-paper' : 'border-line-strong hover:bg-surface'}`;

function Overview() {
  const q = useQuery({ queryKey: ['admin', 'analytics'], queryFn: () => api<{ data: { services: number; published: number; byVerification: Record<string, number>; openFeedback: number; search: { topQueries: { query: string; count: number }[]; zeroResultQueries: string[]; totalSearches: number } } }>('/api/admin/analytics') });
  if (q.isLoading) return <Spinner />;
  if (q.error || !q.data) return <ErrorBox error={q.error} onRetry={() => void q.refetch()} />;
  const d = q.data.data;
  const chart = Object.entries(d.byVerification).map(([name, count]) => ({ name: name.replace('_', ' '), count }));
  return (
    <div className="space-y-6">
      <dl className="grid gap-4 sm:grid-cols-3">
        {[['Services', d.services], ['Published', d.published], ['Open reports', d.openFeedback]].map(([k, v]) => <div key={String(k)} className="border-l-4 border-ink pl-3"><dt className="text-sm text-grey-strong">{k}</dt><dd className="text-2xl font-bold">{v}</dd></div>)}
      </dl>
      <section aria-labelledby="vh"><h2 id="vh" className="mb-2 font-bold">Records by verification status</h2>
        <div className="h-56 w-full" role="img" aria-label={`Bar chart: ${chart.map((c) => `${c.name} ${c.count}`).join(', ')}`}><ResponsiveContainer><BarChart data={chart}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" /><YAxis allowDecimals={false} /><Tooltip /><Bar dataKey="count" fill="#111111" /></BarChart></ResponsiveContainer></div></section>
      <section aria-labelledby="sq"><h2 id="sq" className="mb-2 font-bold">Searches ({d.search.totalSearches}, anonymous)</h2>
        {d.search.topQueries.length ? <ul className="list-disc pl-5 text-sm">{d.search.topQueries.map((s) => <li key={s.query}>{s.query} ({s.count})</li>)}</ul> : <p className="text-sm text-grey-strong">No searches recorded yet.</p>}
        {d.search.zeroResultQueries.length > 0 && <p className="mt-2 text-sm">Searches with no results: {d.search.zeroResultQueries.join(', ')}</p>}</section>
    </div>
  );
}

function ServiceList() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [msg, setMsg] = useState<{ tone: 'good' | 'warn'; text: string } | null>(null);
  const q = useQuery({ queryKey: ['admin', 'services', page], queryFn: () => api<Paged<Service>>(`/api/admin/services${qs({ page, pageSize: 20, sort: 'recent' })}`) });

  const exportCsv = async () => {
    const csv = await api<string>('/api/admin/services/export');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const a = document.createElement('a'); a.href = url; a.download = 'services.csv'; a.click(); URL.revokeObjectURL(url);
  };
  const importCsv = useMutation({
    mutationFn: async (file: File) => api<{ data: { imported: number } }>('/api/admin/services/import', { method: 'POST', raw: await file.text() }),
    onSuccess: (r) => { setMsg({ tone: 'good', text: `Imported ${r.data.imported} service(s) as drafts awaiting verification.` }); void qc.invalidateQueries({ queryKey: ['admin'] }); },
    onError: (e) => {
      const rows = e instanceof ApiError && Array.isArray(e.details) ? (e.details as { row: number; messages: string[] }[]).map((d) => `Row ${d.row}: ${d.messages.join(', ')}`).join(' | ') : '';
      setMsg({ tone: 'warn', text: `${e instanceof Error ? e.message : 'Import failed'}${rows ? ` — ${rows}` : ''}` });
    },
  });
  const onFile = (e: ChangeEvent<HTMLInputElement>) => { const f = e.target.files?.[0]; if (f) importCsv.mutate(f); e.target.value = ''; };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <LinkButton to="/admin/services/new">New service</LinkButton>
        <label className="inline-flex min-h-[48px] cursor-pointer items-center gap-2 rounded-full border border-dark px-6 text-sm font-bold uppercase tracking-[0.06em] transition-colors duration-fast hover:bg-dark hover:text-paper focus-within:outline focus-within:outline-2 focus-within:outline-offset-2"><Upload className="h-4 w-4" aria-hidden />Import CSV<input type="file" accept=".csv,text/csv" className="sr-only" onChange={onFile} /></label>
        <Button variant="secondary" onClick={() => void exportCsv()}><Download className="h-4 w-4" aria-hidden />Export CSV</Button>
      </div>
      <p className="text-xs text-grey-strong">CSV columns: slug, name, short_description, category_id, government_level, state_code, target_beneficiaries (a|b), tags (a|b), application_url, status, source_title, source_url. Any invalid row rejects the whole file.</p>
      {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
      {q.isLoading ? <Spinner /> : q.error ? <ErrorBox error={q.error} onRetry={() => void q.refetch()} /> : !q.data?.data.length ? <Empty title="No services" /> : (
        <div className="overflow-x-auto"><table className="w-full text-left text-sm"><caption className="sr-only">All services</caption>
          <thead><tr className="border-b border-line-strong"><th scope="col" className="py-2 pr-3">Name</th><th scope="col" className="pr-3">Status</th><th scope="col" className="pr-3">Verification</th><th scope="col" className="pr-3">Updated</th><th scope="col"><span className="sr-only">Actions</span></th></tr></thead>
          <tbody>{q.data.data.map((s) => (<tr key={s.id} className="border-b border-line"><td className="py-2 pr-3 font-medium">{s.name}</td><td className="pr-3">{s.status}</td><td className="pr-3"><StatusBadge status={s.verification_status} /></td><td className="pr-3">{formatDate(s.updated_at)}</td><td><Link className="underline" to={`/admin/services/${s.id}`}>Edit</Link></td></tr>))}</tbody></table></div>)}
      {q.data && q.data.meta.total > 20 && <div className="flex gap-3"><Button variant="secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button><Button variant="secondary" disabled={page * 20 >= q.data.meta.total} onClick={() => setPage(page + 1)}>Next</Button></div>}
    </div>
  );
}

function Queue() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['admin', 'queue'], queryFn: () => api<{ data: Service[] }>('/api/admin/verification-queue') });
  const [choice, setChoice] = useState<Record<string, VerificationStatus>>({});
  const verify = useMutation({
    mutationFn: ({ id, to }: { id: string; to: VerificationStatus }) => api(`/api/admin/services/${id}/verify`, { method: 'POST', body: { to_status: to } }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['admin'] }),
  });
  if (q.isLoading) return <Spinner />;
  if (q.error) return <ErrorBox error={q.error} onRetry={() => void q.refetch()} />;
  if (!q.data?.data.length) return <Empty title="Nothing waiting for review" />;
  return (
    <div className="space-y-3">
      <Notice>Only mark a record “verified” after checking its eligibility, documents and steps against the official source. Verification requires at least one official source.</Notice>
      {verify.error && <ErrorBox error={verify.error} />}
      <ul>{q.data.data.map((s) => (
        <li key={s.id} className="flex flex-wrap items-end justify-between gap-3 border-t border-line py-3">
          <div><Link className="font-semibold text-ink underline" to={`/admin/services/${s.id}`}>{s.name}</Link> <StatusBadge status={s.verification_status} />
            <p className="text-xs text-grey-strong">Last verified: {s.last_verified_at ? formatDate(s.last_verified_at) : 'never'}</p></div>
          <div className="flex items-end gap-2">
            <Select label="Set status" value={choice[s.id] ?? 'verified'} onChange={(e) => setChoice({ ...choice, [s.id]: e.target.value as VerificationStatus })}>
              {['verified', 'awaiting_verification', 'outdated', 'link_broken'].map((v) => <option key={v} value={v}>{v.replace('_', ' ')}</option>)}</Select>
            <Button disabled={verify.isPending} onClick={() => verify.mutate({ id: s.id, to: choice[s.id] ?? 'verified' })}>Apply</Button></div></li>))}</ul>
    </div>
  );
}

function Feedback() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['admin', 'feedback'], queryFn: () => api<{ data: { id: string; service_id: string | null; report_type: string; message: string; status: string; created_at: string }[] }>('/api/admin/feedback') });
  const upd = useMutation({ mutationFn: ({ id, status }: { id: string; status: string }) => api(`/api/admin/feedback/${id}`, { method: 'PATCH', body: { status } }), onSuccess: () => void qc.invalidateQueries({ queryKey: ['admin', 'feedback'] }) });
  if (q.isLoading) return <Spinner />;
  if (q.error) return <ErrorBox error={q.error} onRetry={() => void q.refetch()} />;
  if (!q.data?.data.length) return <Empty title="No reports" />;
  return (<div><p className="mb-2 text-sm text-grey-strong">Report text comes from the public: treat it as untrusted.</p>{upd.error && <ErrorBox error={upd.error} />}
    <ul>{q.data.data.map((f) => (<li key={f.id} className="border-t border-line py-3"><p className="text-xs text-grey-strong">{f.report_type} · {formatDate(f.created_at)} · {f.status}</p><p>{f.message}</p>
      <div className="mt-2 flex gap-2">{['reviewing', 'resolved', 'dismissed'].map((s) => <Button key={s} variant="secondary" disabled={f.status === s || upd.isPending} onClick={() => upd.mutate({ id: f.id, status: s })}>{s}</Button>)}</div></li>))}</ul></div>);
}

function Audit() {
  const q = useQuery({ queryKey: ['admin', 'audit'], queryFn: () => api<{ data: { id: string; action: string; entity_type: string; entity_id: string | null; created_at: string }[] }>('/api/admin/audit-logs') });
  if (q.isLoading) return <Spinner />;
  if (q.error) return <ErrorBox error={q.error} onRetry={() => void q.refetch()} />;
  if (!q.data?.data.length) return <Empty title="No audit entries yet" />;
  return <div className="overflow-x-auto"><table className="w-full text-left text-sm"><caption className="sr-only">Audit log</caption><thead><tr className="border-b border-line-strong"><th scope="col" className="py-2">When</th><th scope="col">Action</th><th scope="col">Entity</th></tr></thead>
    <tbody>{q.data.data.map((a) => <tr key={a.id} className="border-b border-line"><td className="py-2">{new Date(a.created_at).toLocaleString()}</td><td>{a.action}</td><td className="font-mono text-xs">{a.entity_type} {a.entity_id ?? ''}</td></tr>)}</tbody></table></div>;
}

export default function Admin() {
  const { t } = useI18n();
  return (
    <PageContainer>
      <header className="mb-6 border-t border-line-strong pt-4"><p className="t-label text-grey-strong">Admin</p><h1 className="t-display mt-2 text-display-md">{t('admin.title')}</h1></header>
      <nav aria-label="Admin sections" className="mb-6 flex flex-wrap gap-2">
        <NavLink end to="/admin" className={tab}>{t('admin.analytics')}</NavLink>
        <NavLink to="/admin/services" className={tab}>{t('admin.services')}</NavLink>
        <NavLink to="/admin/queue" className={tab}>{t('admin.queue')}</NavLink>
        <NavLink to="/admin/feedback" className={tab}>{t('admin.feedback')}</NavLink>
        <NavLink to="/admin/audit" className={tab}>{t('admin.audit')}</NavLink>
      </nav>
      <Routes>
        <Route index element={<Overview />} />
        <Route path="services" element={<ServiceList />} />
        <Route path="services/new" element={<ServiceEditor />} />
        <Route path="services/:id" element={<ServiceEditor />} />
        <Route path="queue" element={<Queue />} />
        <Route path="feedback" element={<Feedback />} />
        <Route path="audit" element={<Audit />} />
      </Routes>
    </PageContainer>
  );
}
