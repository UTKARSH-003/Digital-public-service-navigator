import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { useI18n } from '../i18n';
import { SiteHeader } from './SiteHeader';
import { SiteFooter } from './SiteFooter';

/** Router does not scroll on navigation: reset to top, or to the #hash target when present. */
function ScrollManager() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (hash) {
      const el = document.getElementById(hash.slice(1));
      if (el) { el.scrollIntoView(); return; }
    }
    window.scrollTo(0, 0);
  }, [pathname, hash]);
  return null;
}

export default function Layout() {
  const { t } = useI18n();
  return (
    <div className="flex min-h-screen flex-col">
      <a href="#main" className="skip-link">{t('skip')}</a>
      <div className="bg-dark px-4 py-2 text-center text-xs font-bold tracking-wide" style={{ color: 'var(--color-footer-text)' }}>{t('banner.disclaimer')}</div>
      <SiteHeader />
      <ScrollManager />
      <main id="main" className="flex-1"><Outlet /></main>
      <SiteFooter />
    </div>
  );
}
