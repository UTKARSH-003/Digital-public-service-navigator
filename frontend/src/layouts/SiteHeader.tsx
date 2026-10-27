import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { useI18n, type Lang } from '../i18n';
import { useAuth } from '../hooks/useAuth';

const SIZES = ['100%', '115%', '130%'];

const navCls = ({ isActive }: { isActive: boolean }) =>
  `t-label inline-flex min-h-[44px] items-center border-b-2 px-1 text-[0.875rem] font-bold transition-colors duration-fast hover:text-muted hover:underline ${isActive ? 'border-ink' : 'border-transparent'}`;
const pill = 't-label inline-flex min-h-[44px] items-center rounded-full border border-dark px-5 text-[0.8rem] transition-colors duration-fast';

export function SiteHeader() {
  const { t, lang, setLang } = useI18n();
  const { session, role, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const [size, setSize] = useState(0);
  const btnRef = useRef<HTMLButtonElement>(null);
  const loc = useLocation();
  const staff = role !== 'user';

  useEffect(() => { setOpen(false); }, [loc.pathname, loc.hash]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(false); btnRef.current?.focus(); } };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  const bumpSize = () => {
    const next = (size + 1) % SIZES.length;
    setSize(next);
    document.documentElement.style.fontSize = SIZES[next] ?? '100%';
  };

  return (
    <header className="sticky top-0 z-50 border-b border-line backdrop-blur-[12px]" style={{ background: 'rgba(242,242,242,0.9)' }}>
      <div className="page flex h-20 items-center justify-between gap-6">
        <Link to="/" className="t-display flex items-baseline gap-2 text-lg leading-none sm:text-xl" aria-label={t('app.name')}>
          <span className="inline-block h-3 w-3 bg-ink" aria-hidden />
          <span className="max-w-[11rem] leading-[1] sm:max-w-none">{t('app.name')}</span>
        </Link>

        <button ref={btnRef} className="grid h-11 w-11 place-items-center border border-dark lg:hidden" aria-expanded={open} aria-controls="main-nav" onClick={() => setOpen(!open)}>
          {open ? <X className="h-5 w-5" aria-hidden /> : <Menu className="h-5 w-5" aria-hidden />}<span className="sr-only">{t('nav.menu')}</span>
        </button>

        <nav id="main-nav" aria-label="Main" className={`${open ? 'flex' : 'hidden'} absolute inset-x-0 top-20 flex-col gap-1 border-b border-line bg-paper px-[var(--gutter)] pb-6 pt-4 lg:static lg:flex lg:flex-1 lg:flex-row lg:items-center lg:justify-between lg:border-0 lg:bg-transparent lg:p-0`}>
          <div className="flex flex-col lg:ml-10 lg:flex-row lg:items-center lg:gap-7">
            <NavLink to="/" end className={navCls}>{t('nav.home')}</NavLink>
            <NavLink to="/services" end className={navCls}>{t('nav.services')}</NavLink>
            <Link to="/#categories" className={navCls({ isActive: false })}>{t('nav.categories')}</Link>
            <NavLink to="/assistant" className={navCls}>{t('nav.assistant')}</NavLink>
            {session && <NavLink to="/dashboard" className={navCls}>{t('nav.dashboard')}</NavLink>}
            {staff && <NavLink to="/admin" className={navCls}>{t('nav.admin')}</NavLink>}
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3 lg:mt-0">
            <label className="sr-only" htmlFor="lang">{t('lang.label')}</label>
            <select id="lang" value={lang} onChange={(e) => setLang(e.target.value as Lang)} className="t-label min-h-[44px] border border-dark bg-transparent px-3 text-[0.8rem]">
              <option value="en">English</option><option value="hi">हिन्दी</option>
            </select>
            <button onClick={bumpSize} className="t-label min-h-[44px] border border-dark px-3 text-[0.8rem] hover:bg-dark hover:text-paper" aria-label={`${t('text.size')}: ${SIZES[size]}`}>A<span aria-hidden>+</span></button>
            {session
              ? <button onClick={() => void signOut()} className={`${pill} hover:bg-dark hover:text-paper`}>{t('nav.signout')}</button>
              : <Link to="/login" className={`${pill} bg-dark text-paper hover:bg-transparent hover:text-ink`}>{t('nav.signin')}</Link>}
          </div>
        </nav>
      </div>
    </header>
  );
}
