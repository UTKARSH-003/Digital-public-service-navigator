import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, ArrowUpRight, Check, Send } from 'lucide-react';
import { api } from '../services/api';
import type { Category, Paged, Service } from '../types';
import { useI18n } from '../i18n';
import type { MessageKey } from '../i18n/en';
import { ErrorBox, LinkButton, SectionHeading, Spinner } from '../components/ui';
import { ServiceCard, ServiceGrid } from '../components/ServiceCard';
import { TypographicEcho } from '../components/TypographicEcho';
import { SearchBar } from '../components/SearchBar';
import { PillShowcase } from '../components/PillShowcase';
import { Reveal } from '../components/Reveal';

const QUICK = ['scholarship', 'pension', 'certificate', 'farmer'];

function Hero() {
  const { t } = useI18n();
  const nav = useNavigate();
  return (
    <section aria-labelledby="hero-title" className="page flex min-h-[70vh] flex-col justify-between gap-12 pb-14 pt-10 lg:min-h-[calc(100svh-112px)]">
      <p className="t-label text-grey-strong">{t('app.tagline')}</p>
      <div className="overflow-x-clip"><TypographicEcho id="hero-title" lines={t('home.hero.title').split('|')} /></div>
      <div className="grid gap-8 lg:grid-cols-12 lg:items-end">
        <p className="max-w-md text-xl font-medium lg:col-span-4">{t('home.hero.sub')}</p>
        <div className="lg:col-span-8">
          <SearchBar id="home-q" label={t('home.search.label')} placeholder={t('home.search.placeholder')} buttonLabel={t('home.search.button')}
            onSubmit={(q) => nav(`/services${q ? `?q=${encodeURIComponent(q)}` : ''}`)} />
          <ul className="mt-4 flex flex-wrap gap-2">
            {QUICK.map((w) => <li key={w}><Link to={`/services?q=${w}`} className="t-label inline-flex min-h-[40px] items-center rounded-full border border-line-strong px-4 text-[0.75rem] transition-colors duration-fast hover:bg-dark hover:text-paper">{w}</Link></li>)}
          </ul>
        </div>
      </div>
    </section>
  );
}

function Narrative() {
  const { t } = useI18n();
  const cols: [MessageKey, MessageKey][] = [['home.col1.t', 'home.col1.d'], ['home.col2.t', 'home.col2.d'], ['home.col3.t', 'home.col3.d']];
  return (
    <section aria-labelledby="narr" className="page py-24 lg:py-32">
      <div className="mx-auto h-24 w-px bg-line-strong" aria-hidden />
      <p className="t-label mt-8 text-center text-grey-strong">{t('home.narr.kicker')}</p>
      <h2 id="narr" className="t-display mx-auto mt-6 max-w-5xl text-center text-display-lg">
        {t('home.narr.before')}<em className="t-serif text-[1.08em] font-normal">{t('home.narr.em')}</em>{t('home.narr.after')}
      </h2>
      <div className="mt-20 grid gap-x-8 gap-y-10 md:grid-cols-3">
        {cols.map(([h, d], i) => (
          <div key={h} className="border-t border-line-strong pt-5">
            <p className="t-label text-grey-strong">0{i + 1}</p>
            <h3 className="t-display mt-2 text-display-sm">{t(h)}</h3>
            <p className="mt-3 text-grey-strong">{t(d)}</p>
          </div>))}
      </div>
    </section>
  );
}

/** Box used by the three rectangular/square showcase tiles. Whole tile is one real link. */
function Tile({ to, className = '', children, label }: { to: string; className?: string; children: React.ReactNode; label: string }) {
  return (
    <Link to={to} aria-label={label} className={`group relative flex overflow-hidden border border-line-strong bg-transparent transition-colors duration-fast hover:bg-surface focus-visible:outline-offset-4 ${className}`}>{children}</Link>
  );
}

function Showcase({ recent }: { recent: Service[] }) {
  const { t } = useI18n();
  const outcomes = ['likely_eligible', 'likely_not_eligible', 'insufficient_information'] as const;
  return (
    <section aria-labelledby="show" className="page pb-24">
      <SectionHeading id="show" eyebrow="01" className="mb-10">{t('home.show.title')}</SectionHeading>
      <div className="grid grid-cols-12 gap-6 lg:gap-8">
        {/* A: 8 columns */}
        <Reveal className="col-span-12 lg:col-span-8">
          <Tile to="/services" label={`${t('home.show.discover')}. ${t('home.show.discover.d')}`} className="min-h-[500px] flex-col justify-between p-8 lg:h-[500px]">
            <div>
              <p className="t-label text-grey-strong">01 / {t('nav.services')}</p>
              <h3 className="t-display mt-3 max-w-md text-display-md">{t('home.show.discover')}</h3>
              <p className="mt-3 max-w-sm text-grey-strong">{t('home.show.discover.d')}</p>
            </div>
            <div className="grayscale-hover mt-8 space-y-2 self-end sm:w-[62%]" aria-hidden>
              {recent.slice(0, 3).map((s) => (
                <div key={s.id} className="flex items-center justify-between gap-4 border border-line bg-surface px-4 py-3 text-sm">
                  <span className="truncate font-bold">{s.name}</span><ArrowUpRight className="h-4 w-4 shrink-0" />
                </div>))}
            </div>
          </Tile>
        </Reveal>

        {/* B: 4 columns, vertical pill */}
        <Reveal className="col-span-12 mx-auto w-full max-w-sm lg:col-span-4 lg:max-w-none">
          <PillShowcase to="/services" title={t('home.show.elig')} detail={t('home.show.elig.d')}>
            <div className="flex h-full w-full">
              {outcomes.map((o, i) => <div key={o} className="flex-1" style={{ background: `var(--color-echo-${4 - i})` }} />)}
            </div>
          </PillShowcase>
        </Reveal>

        {/* C: 5 columns, square */}
        <Reveal className="col-span-12 md:col-span-6 lg:col-span-5">
          <Tile to="/services" label={`${t('home.show.docs')}. ${t('home.show.docs.d')}`} className="aspect-square flex-col justify-between p-8">
            <div>
              <p className="t-label text-grey-strong">03 / {t('svc.documents')}</p>
              <h3 className="t-display mt-3 text-display-md">{t('home.show.docs')}</h3>
              <p className="mt-3 max-w-xs text-grey-strong">{t('home.show.docs.d')}</p>
            </div>
            <ul className="grayscale-hover space-y-3" aria-hidden>
              {[true, true, false, false].map((done, i) => (
                <li key={i} className="flex items-center gap-3"><span className={`grid h-5 w-5 place-items-center border border-dark ${done ? 'bg-dark text-paper' : ''}`}>{done && <Check className="h-3.5 w-3.5" />}</span><span className="h-2 bg-echo-2" style={{ width: `${70 - i * 12}%` }} /></li>))}
            </ul>
          </Tile>
        </Reveal>

        {/* D: 7 columns, wide */}
        <Reveal className="col-span-12 md:col-span-6 lg:col-span-7">
          <Tile to="/assistant" label={`${t('home.show.ai')}. ${t('home.show.ai.d')}`} className="min-h-full flex-col justify-between gap-10 p-8 lg:aspect-auto">
            <div>
              <p className="t-label text-grey-strong">04 / {t('nav.assistant')}</p>
              <h3 className="t-display mt-3 text-display-md">{t('home.show.ai')}</h3>
              <p className="mt-3 max-w-md text-grey-strong">{t('home.show.ai.d')}</p>
            </div>
            <div className="grayscale-hover flex items-center justify-between gap-4 border border-dark bg-surface px-5 py-4 text-grey-strong" aria-hidden>
              <span>{t('assist.placeholder')}</span><Send className="h-4 w-4 text-ink" />
            </div>
          </Tile>
        </Reveal>
      </div>
    </section>
  );
}

function Featured({ items, cats }: { items: Service[]; cats: Category[] }) {
  const { t } = useI18n();
  return (
    <section aria-labelledby="feat" className="page pb-24">
      <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
        <SectionHeading id="feat" eyebrow="02" className="flex-1">{t('home.featured')}</SectionHeading>
        <LinkButton to="/services" variant="secondary">{t('home.all')}<ArrowRight className="h-4 w-4" aria-hidden /></LinkButton>
      </div>
      <ServiceGrid>{items.map((s) => <ServiceCard key={s.id} s={s} category={cats.find((c) => c.id === s.category_id)} />)}</ServiceGrid>
    </section>
  );
}

function CategoryIndex({ cats }: { cats: Category[] }) {
  const { t, lang } = useI18n();
  return (
    <section id="categories" aria-labelledby="cats" className="page pb-24">
      <SectionHeading id="cats" eyebrow={t('home.cat.eyebrow')} className="mb-6">{t('home.categories')}</SectionHeading>
      <ol className="border-b border-line">
        {cats.map((c, i) => (
          <li key={c.id} className="border-t border-line">
            <Link to={`/services?category=${c.slug}`} className="group flex items-center gap-6 px-2 py-5 transition-colors duration-fast hover:bg-surface focus-visible:outline-offset-[-3px] sm:px-4">
              <span className="t-label w-8 text-grey-strong">{String(i + 1).padStart(2, '0')}</span>
              <span className="t-display flex-1 text-display-sm">{lang === 'hi' && c.name_hi ? c.name_hi : c.name_en}</span>
              <ArrowRight className="h-5 w-5 transition-transform duration-fast group-hover:translate-x-1" aria-hidden />
            </Link>
          </li>))}
      </ol>
    </section>
  );
}

export default function Home() {
  const { t } = useI18n();
  const cats = useQuery({ queryKey: ['categories'], queryFn: () => api<{ data: Category[] }>('/api/categories') });
  const recent = useQuery({ queryKey: ['services', 'home'], queryFn: () => api<Paged<Service>>('/api/services?sort=recent&pageSize=6') });
  const catList = cats.data?.data ?? [];
  const items = recent.data?.data ?? [];

  return (
    <>
      <Hero />
      <Narrative />
      <Showcase recent={items} />
      {recent.isLoading ? <div className="page"><Spinner /></div> : recent.error ? <div className="page pb-24"><ErrorBox error={recent.error} onRetry={() => void recent.refetch()} /></div> : <Featured items={items} cats={catList} />}
      {cats.isLoading ? <div className="page"><Spinner /></div> : cats.error ? <div className="page pb-24"><ErrorBox error={cats.error} onRetry={() => void cats.refetch()} /></div> : <CategoryIndex cats={catList} />}
      <section aria-labelledby="elig" className="page pb-8">
        <div className="grid gap-8 border-t border-line-strong pt-6 lg:grid-cols-12">
          <h2 id="elig" className="t-display text-display-md lg:col-span-5">{t('home.elig.title')}</h2>
          <div className="lg:col-span-7"><p className="max-w-2xl text-lg">{t('home.elig.body')}</p><LinkButton to="/services" variant="secondary" className="mt-6">{t('nav.services')}</LinkButton></div>
        </div>
      </section>
    </>
  );
}
