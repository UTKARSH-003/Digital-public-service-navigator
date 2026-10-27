import { Link } from 'react-router-dom';
import { Landmark, Scale, Compass, ExternalLink as ExtIcon } from 'lucide-react';
import { useI18n } from '../i18n';

const head = 't-label mb-4 flex items-center gap-2 text-footer-text';
const link = 'underline-offset-4 hover:text-footer-text hover:underline';

export function SiteFooter() {
  const { t } = useI18n();
  return (
    <footer className="on-dark mt-24 bg-dark" style={{ color: 'rgba(246,246,246,0.6)' }}>
      <div className="page border-t py-16" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
        <div className="grid gap-12 text-[0.95rem] md:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="t-display flex items-center gap-2 text-2xl text-footer-text"><Landmark className="h-5 w-5" aria-hidden />{t('app.name')}</p>
            <p className="mt-4 max-w-xs">{t('footer.purpose')}</p>
          </div>
          <nav aria-label="Services">
            <p className={head}><Compass className="h-4 w-4" aria-hidden />{t('nav.services')}</p>
            <ul className="space-y-2">
              <li><Link className={link} to="/services">{t('nav.services')}</Link></li>
              <li><Link className={link} to="/#categories">{t('nav.categories')}</Link></li>
              <li><Link className={link} to="/assistant">{t('nav.assistant')}</Link></li>
            </ul>
          </nav>
          <nav aria-label="Footer">
            <p className={head}><Scale className="h-4 w-4" aria-hidden />{t('footer.legal')}</p>
            <ul className="space-y-2">
              <li><Link className={link} to="/legal/privacy">{t('footer.privacy')}</Link></li>
              <li><Link className={link} to="/legal/terms">{t('footer.terms')}</Link></li>
              <li><Link className={link} to="/legal/disclaimer">{t('footer.disclaimer')}</Link></li>
              <li><Link className={link} to="/legal/contact">{t('footer.contact')}</Link></li>
            </ul>
          </nav>
          <div>
            <p className={head}><ExtIcon className="h-4 w-4" aria-hidden />{t('footer.sources')}</p>
            <ul className="space-y-2">
              {[['India.gov.in', 'https://www.india.gov.in/'], ['myScheme', 'https://www.myscheme.gov.in/'], ['National Scholarship Portal', 'https://scholarships.gov.in/'], ['Services portal', 'https://services.india.gov.in/']].map(([n, u]) => (
                <li key={u}><a className={link} href={u} target="_blank" rel="noopener noreferrer">{n}<span className="sr-only"> (opens in a new tab)</span></a></li>))}
            </ul>
          </div>
        </div>
        <p className="mt-14 border-t pt-6 text-sm" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>{t('banner.disclaimer')} {t('footer.note')}</p>
      </div>
    </footer>
  );
}
