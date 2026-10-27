import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '../services/api';
import type { Category, ServiceDetail } from '../types';
import { Button, ErrorBox, Field, Notice, Select, Spinner } from '../components/ui';
import { STATES } from '../utils';

const schema = z.object({
  name: z.string().trim().min(3, 'At least 3 characters').max(200),
  slug: z.string().regex(/^[a-z0-9-]+$/, 'Lowercase letters, digits and hyphens only').min(3).max(120),
  short_description: z.string().trim().min(10, 'At least 10 characters').max(600),
  category_id: z.coerce.number().int().positive('Choose a category'),
  government_level: z.enum(['central', 'state']),
  state_code: z.string().optional(),
  application_url: z.string().optional().refine((v) => !v || /^https:\/\//i.test(v), 'Must start with https://'),
  fees_text: z.string().max(500).optional(),
  important_dates_text: z.string().max(500).optional(),
  tags: z.string().optional(),
  target_beneficiaries: z.string().optional(),
  status: z.enum(['draft', 'published', 'archived']),
}).refine((v) => v.government_level === 'central' || Boolean(v.state_code), { path: ['state_code'], message: 'Required for state services' });
type FormValues = z.infer<typeof schema>;

interface RuleRow { field: string; operator: string; value: string; mandatory: boolean; question_text: string; description: string }
const FIELDS = ['state_code', 'age', 'occupation', 'annual_income', 'education_level', 'gender', 'category', 'disability', 'residency'];
const OPS = ['eq', 'neq', 'in', 'not_in', 'gte', 'lte', 'between'];

const parseValue = (s: string): unknown => { try { return JSON.parse(s); } catch { return s; } };
const csv = (s?: string) => (s ?? '').split(',').map((x) => x.trim()).filter(Boolean);

export default function ServiceEditor() {
  const { id } = useParams();
  const isNew = !id || id === 'new';
  const nav = useNavigate();
  const qc = useQueryClient();
  const cats = useQuery({ queryKey: ['categories'], queryFn: () => api<{ data: Category[] }>('/api/categories') });
  const existing = useQuery({ enabled: !isNew, queryKey: ['admin', 'service', id], queryFn: () => api<{ data: ServiceDetail }>(`/api/admin/services/${id}`) });
  const { register, handleSubmit, reset, watch, formState: { errors } } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { government_level: 'central', status: 'draft' } });
  const [docs, setDocs] = useState('');
  const [steps, setSteps] = useState('');
  const [sources, setSources] = useState('');
  const [rules, setRules] = useState<RuleRow[]>([]);
  const [formErr, setFormErr] = useState('');

  useEffect(() => {
    const s = existing.data?.data;
    if (!s) return;
    reset({ name: s.name, slug: s.slug, short_description: s.short_description, category_id: s.category_id, government_level: s.government_level, state_code: s.state_code ?? '', application_url: s.application_url ?? '', fees_text: s.fees_text ?? '', important_dates_text: s.important_dates_text ?? '', tags: s.tags.join(', '), target_beneficiaries: s.target_beneficiaries.join(', '), status: s.status });
    setDocs(s.documents.map((d) => d.notes ? `${d.name} | ${d.notes}` : d.name).join('\n'));
    setSteps(s.steps.map((x) => x.details ? `${x.title} | ${x.details}` : x.title).join('\n'));
    setSources(s.sources.map((x) => `${x.title} | ${x.url}`).join('\n'));
    setRules((s.rules as unknown as (RuleRow & { value: unknown; question_text: string })[]).map((r) => ({ field: r.field, operator: r.operator, value: typeof r.value === 'string' ? r.value : JSON.stringify(r.value), mandatory: r.mandatory, question_text: r.question_text, description: r.description })));
  }, [existing.data, reset]);

  const save = useMutation({
    mutationFn: (v: FormValues) => {
      const lines = (t: string) => t.split('\n').map((l) => l.trim()).filter(Boolean);
      const srcRows = lines(sources).map((l, i) => { const [title, url] = l.split('|').map((x) => x.trim()); return { title: title ?? '', url: url ?? '', is_primary: i === 0 }; });
      const body = {
        slug: v.slug, name: v.name, short_description: v.short_description, category_id: v.category_id, government_level: v.government_level,
        state_code: v.government_level === 'state' ? v.state_code : null, application_url: v.application_url || null,
        fees_text: v.fees_text || null, important_dates_text: v.important_dates_text || null, tags: csv(v.tags), target_beneficiaries: csv(v.target_beneficiaries), status: v.status,
        documents: lines(docs).map((l) => { const [name, notes] = l.split('|').map((x) => x.trim()); return { name: name ?? '', notes: notes || null, is_mandatory: true }; }),
        steps: lines(steps).map((l) => { const [title, details] = l.split('|').map((x) => x.trim()); return { title: title ?? '', details: details || null }; }),
        sources: srcRows,
        rules: rules.map((r, i) => ({ field: r.field, operator: r.operator, value: parseValue(r.value), mandatory: r.mandatory, question_text: r.question_text, description: r.description, sort_order: i + 1 })),
      };
      return isNew ? api<{ data: ServiceDetail }>('/api/admin/services', { method: 'POST', body }) : api<{ data: ServiceDetail }>(`/api/admin/services/${id}`, { method: 'PATCH', body });
    },
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['admin'] }); nav('/admin/services'); },
    onError: (e) => setFormErr(e instanceof ApiError && Array.isArray(e.details) ? `${e.message}: ${(e.details as { path: string; message: string }[]).map((d) => `${d.path} ${d.message}`).join('; ')}` : e instanceof Error ? e.message : 'Save failed'),
  });

  if (!isNew && existing.isLoading) return <Spinner />;
  if (!isNew && existing.error) return <ErrorBox error={existing.error} />;
  const level = watch('government_level');
  const area = 'w-full  border border-line-strong p-3 font-mono text-sm';

  return (
    <form onSubmit={handleSubmit((v) => { setFormErr(''); save.mutate(v); })} className="max-w-3xl space-y-5" noValidate>
      <h2 className="text-xl font-bold text-ink">{isNew ? 'New service' : 'Edit service'}</h2>
      <Notice>Saving never marks a record verified. Use the verification queue after checking the official source.</Notice>
      <Field label="Name" {...register('name')} error={errors.name?.message} />
      <Field label="Slug" {...register('slug')} error={errors.slug?.message} hint="Used in the page address, e.g. my-scheme" />
      <div className="space-y-1"><label htmlFor="desc" className="block text-sm font-medium">Short description</label><textarea id="desc" rows={3} className="w-full  border border-line-strong p-3" {...register('short_description')} />{errors.short_description && <p role="alert" className="text-sm text-danger">{errors.short_description.message}</p>}</div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Select label="Category" {...register('category_id')}><option value="">—</option>{cats.data?.data.map((c) => <option key={c.id} value={c.id}>{c.name_en}</option>)}</Select>
        <Select label="Level" {...register('government_level')}><option value="central">Central</option><option value="state">State</option></Select>
        {level === 'state' && <Select label="State / UT" {...register('state_code')}><option value="">—</option>{STATES.map(([c, n]) => <option key={c} value={c}>{n}</option>)}</Select>}
      </div>
      {errors.state_code && <p role="alert" className="text-sm text-danger">{errors.state_code.message}</p>}
      <Field label="Application URL (https only)" {...register('application_url')} error={errors.application_url?.message} />
      <div className="grid gap-4 sm:grid-cols-2"><Field label="Fees (leave blank if not verified)" {...register('fees_text')} /><Field label="Important dates (leave blank if not verified)" {...register('important_dates_text')} /></div>
      <div className="grid gap-4 sm:grid-cols-2"><Field label="Tags (comma separated)" {...register('tags')} /><Field label="Target beneficiaries (comma separated)" {...register('target_beneficiaries')} /></div>
      <Select label="Publication status" {...register('status')}><option value="draft">Draft</option><option value="published">Published</option><option value="archived">Archived</option></Select>

      <fieldset className="space-y-2"><legend className="font-semibold">Official sources</legend><p className="text-xs text-grey-strong">One per line: Title | https://url. The first is primary.</p><textarea aria-label="Official sources" rows={3} className={area} value={sources} onChange={(e) => setSources(e.target.value)} /></fieldset>
      <fieldset className="space-y-2"><legend className="font-semibold">Required documents</legend><p className="text-xs text-grey-strong">One per line: Name | optional note</p><textarea aria-label="Required documents" rows={4} className={area} value={docs} onChange={(e) => setDocs(e.target.value)} /></fieldset>
      <fieldset className="space-y-2"><legend className="font-semibold">Application steps</legend><p className="text-xs text-grey-strong">One per line, in order: Title | optional details</p><textarea aria-label="Application steps" rows={4} className={area} value={steps} onChange={(e) => setSteps(e.target.value)} /></fieldset>

      <fieldset className="space-y-3"><legend className="font-semibold">Eligibility rules</legend>
        <p className="text-xs text-grey-strong">Value is JSON for numbers and lists, e.g. 60, [15,45], ["student","farmer"], or plain text for a single word.</p>
        {rules.map((r, i) => { const up = (p: Partial<RuleRow>) => setRules(rules.map((x, j) => j === i ? { ...x, ...p } : x)); return (
          <div key={i} className="space-y-2 border-l-4 border-ink pl-3">
            <div className="grid gap-2 sm:grid-cols-3">
              <Select label="Field" value={r.field} onChange={(e) => up({ field: e.target.value })}>{FIELDS.map((f) => <option key={f}>{f}</option>)}</Select>
              <Select label="Operator" value={r.operator} onChange={(e) => up({ operator: e.target.value })}>{OPS.map((f) => <option key={f}>{f}</option>)}</Select>
              <Field label="Value" value={r.value} onChange={(e) => up({ value: e.target.value })} /></div>
            <Field label="Question shown to the citizen" value={r.question_text} onChange={(e) => up({ question_text: e.target.value })} />
            <Field label="Rule description" value={r.description} onChange={(e) => up({ description: e.target.value })} />
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-5 w-5" checked={r.mandatory} onChange={(e) => up({ mandatory: e.target.checked })} />Required condition (unticked = informational only)</label>
            <Button variant="ghost" onClick={() => setRules(rules.filter((_, j) => j !== i))}>Remove rule</Button></div>); })}
        <Button variant="secondary" onClick={() => setRules([...rules, { field: 'age', operator: 'gte', value: '', mandatory: true, question_text: '', description: '' }])}>Add rule</Button>
      </fieldset>

      {formErr && <div role="alert"><ErrorBox error={new Error(formErr)} /></div>}
      <div className="flex gap-3"><Button type="submit" disabled={save.isPending}>Save</Button><Button variant="secondary" onClick={() => nav('/admin/services')}>Cancel</Button></div>
    </form>
  );
}
