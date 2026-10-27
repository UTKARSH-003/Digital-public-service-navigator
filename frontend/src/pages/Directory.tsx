import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api, qs } from '../services/api';
import type { Category, Paged, Service } from '../types';
import { useI18n } from '../i18n';
import { useDebounce } from '../hooks/useDebounce';
import { Button, Empty, ErrorBox, Field, PageContainer, PageTitle, Select, Spinner } from '../components/ui';
import { ServiceCard, ServiceGrid } from '../components/ServiceCard';
import { STATES } from '../utils';

export default function Directory() {
  const { t, lang } = useI18n();
  const [params, setParams] = useSearchParams();
  const [text, setText] = useState(params.get('q') ?? '');
  const debounced = useDebounce(text);
  const category = params.get('category') ?? '';
  const state = params.get('state') ?? '';
  const sort = params.get('sort') ?? 'relevance';
  const page = Math.max(1, Number(params.get('page')) || 1);

  const set = (k: string, v: string) => {
    const next = new URLSearchParams(params);
    if (v) next.set(k, v); else next.delete(k);
    if (k !== 'page') next.delete('page');
    setParams(next, { replace: true });
  };

  useEffect(() => {
    setParams((prev) => {
      if ((prev.get('q') ?? '') === debounced) return prev;
      const next = new URLSearchParams(prev);
      if (debounced) next.set('q', debounced); else next.delete('q');
      next.delete('page');
      return next;
    }, { replace: true });
  }, [debounced, setParams]);

  const cats = useQuery({ queryKey: ['categories'], queryFn: () => api<{ data: Category[] }>('/api/categories') });
  const q = params.get('q') ?? '';
  const list = useQuery({
    queryKey: ['services', q, category, state, sort, page],
    queryFn: () => api<Paged<Service>>(`/api/services${qs({ q, category, state, sort, page, pageSize: 12 })}`),
    placeholderData: (prev) => prev,
  });
  const total = list.data?.meta.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / 12));

  const catList = cats.data?.data ?? [];
  return (
    <PageContainer>
      <PageTitle eyebrow="Directory">{t('dir.title')}</PageTitle>
      <form role="search" onSubmit={(e) => e.preventDefault()} className="mb-8 grid gap-5 border border-line-strong bg-surface p-5 sm:grid-cols-2 lg:grid-cols-4">
        <Field label={t('dir.search')} value={text} onChange={(e) => setText(e.target.value)} type="search" />
        <Select label={t('dir.category')} value={category} onChange={(e) => set('category', e.target.value)}>
          <option value="">{t('dir.all')}</option>
          {catList.map((c) => <option key={c.id} value={c.slug}>{lang === 'hi' && c.name_hi ? c.name_hi : c.name_en}</option>)}
        </Select>
        <Select label={t('dir.state')} value={state} onChange={(e) => set('state', e.target.value)}>
          <option value="">{t('dir.all')}</option>
          {STATES.map(([c, n]) => <option key={c} value={c}>{n}</option>)}
        </Select>
        <Select label={t('dir.sort')} value={sort} onChange={(e) => set('sort', e.target.value)}>
          {(['relevance', 'name', 'recent', 'verified'] as const).map((s) => <option key={s} value={s}>{t(`dir.sort.${s}`)}</option>)}
        </Select>
      </form>
      <p className="t-label mb-4 text-grey-strong" aria-live="polite">{list.data ? `${total} ${t('dir.results')}` : ''}</p>
      {list.isLoading ? <Spinner /> : list.error ? <ErrorBox error={list.error} onRetry={() => void list.refetch()} /> :
        total === 0 ? <Empty title={t('dir.none')} hint={t('dir.none.hint')} /> : (
          <>
            <ServiceGrid>{list.data?.data.map((s) => <ServiceCard key={s.id} s={s} category={catList.find((c) => c.id === s.category_id)} />)}</ServiceGrid>
            <nav aria-label="Pagination" className="mt-10 flex items-center justify-between">
              <Button variant="secondary" disabled={page <= 1} onClick={() => set('page', String(page - 1))}>{t('dir.prev')}</Button>
              <span className="t-label">{page} / {pages}</span>
              <Button variant="secondary" disabled={page >= pages} onClick={() => set('page', String(page + 1))}>{t('dir.next')}</Button>
            </nav>
          </>)}
    </PageContainer>
  );
}
