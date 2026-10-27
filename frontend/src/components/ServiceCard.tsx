import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import type { Category, Service } from '../types';
import { StatusBadge } from './ui';
import { categoryIcon } from './categoryIcon';
import { useI18n } from '../i18n';

interface Props {
  s: Service;
  category?: Category;
  /** `row`: compact, for search results. `feature`: with the 64px geometric tile, for previews and the grid. */
  variant?: 'row' | 'feature';
}

/**
 * Whole card is clickable via a stretched link on the title (`after:absolute after:inset-0`), so the real
 * navigation target (/services/:slug) and keyboard behaviour are one anchor. Border/hover handled by the grid wrapper.
 */
export function ServiceCard({ s, category, variant = 'feature' }: Props) {
  const { t, lang } = useI18n();
  const Icon = categoryIcon(category?.icon);
  const catName = category ? (lang === 'hi' && category.name_hi ? category.name_hi : category.name_en) : null;
  const jurisdiction = s.government_level === 'central' ? 'Central' : `State · ${s.state_code}`;

  return (
    <li className="group relative flex h-full flex-col gap-5 bg-transparent p-6 transition-colors duration-fast hover:bg-surface focus-within:bg-surface sm:p-8">
      <div className="flex items-start justify-between gap-4">
        {variant === 'feature' ? (
          <span className="tile" aria-hidden><Icon className="h-6 w-6" strokeWidth={1.5} /></span>
        ) : (
          <StatusBadge status={s.verification_status} />
        )}
        <span className="t-label text-right text-grey-strong">{[catName, jurisdiction].filter(Boolean).join(' · ')}</span>
      </div>
      <div className="flex-1">
        <h3 className="t-display text-display-sm">
          <Link to={`/services/${s.slug}`} className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-offset-[-3px]">{s.name}</Link>
        </h3>
        <p className="mt-3 line-clamp-3 text-grey-strong">{s.short_description}</p>
      </div>
      <div className="flex items-center justify-between gap-3">
        {variant === 'feature' ? <StatusBadge status={s.verification_status} /> : <span />}
        <span className="t-label inline-flex items-center gap-2">{t('card.view')}<ArrowRight className="h-4 w-4 transition-transform duration-fast group-hover:translate-x-1" aria-hidden /></span>
      </div>
    </li>
  );
}

/** Hairline grid: 1px lines between cards at any column count. */
export function ServiceGrid({ children, columns = 3 }: { children: React.ReactNode; columns?: 2 | 3 }) {
  const cols = columns === 3 ? 'md:grid-cols-2 lg:grid-cols-3' : 'md:grid-cols-2';
  return <ul className={`grid grid-cols-1 border-l border-t border-line [&>li]:border-b [&>li]:border-r [&>li]:border-line ${cols}`}>{children}</ul>;
}
