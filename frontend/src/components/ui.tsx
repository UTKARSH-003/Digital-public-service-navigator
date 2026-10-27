import { forwardRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from 'react';
import { Link, type LinkProps } from 'react-router-dom';
import { AlertTriangle, ArrowUpRight, CheckCircle2, FlaskConical, Info, ShieldAlert } from 'lucide-react';
import { useI18n } from '../i18n';
import type { MessageKey } from '../i18n/en';
import type { VerificationStatus } from '../types';

/* ───── buttons: pill-shaped, 1px dark border, inverted on hover (same language as the nav CTA) ───── */
const btn =
  'inline-flex items-center justify-center gap-2 rounded-full border px-6 py-2.5 min-h-[48px] text-sm font-bold uppercase tracking-[0.06em] ' +
  'transition-colors duration-fast disabled:cursor-not-allowed disabled:opacity-40 active:translate-y-px';
const variants = {
  primary: 'border-dark bg-dark text-paper hover:bg-transparent hover:text-ink',
  secondary: 'border-dark bg-transparent text-ink hover:bg-dark hover:text-paper',
  danger: 'border-danger bg-danger text-white hover:bg-transparent hover:text-danger',
  ghost: 'border-transparent bg-transparent text-ink underline hover:bg-surface',
};
type Variant = keyof typeof variants;

export function Button({ variant = 'primary', className = '', ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return <button type="button" {...p} className={`${btn} ${variants[variant]} ${className}`} />;
}
export function LinkButton({ variant = 'primary', className = '', ...p }: LinkProps & { variant?: Variant }) {
  return <Link {...p} className={`${btn} ${variants[variant]} ${className}`} />;
}
export function ExternalLink({ href, children, className = '' }: { href: string; children: ReactNode; className?: string }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={`inline-flex items-center gap-1 font-bold underline decoration-1 underline-offset-4 hover:bg-surface ${className}`}>
      {children}
      <ArrowUpRight className="h-4 w-4 shrink-0" aria-hidden />
      <span className="sr-only"> (opens official site in a new tab)</span>
    </a>
  );
}

/* ───── form controls: sharp boxes, uppercase labels ───── */
const control = 'w-full border border-line-strong bg-surface px-4 py-3 min-h-[48px] text-base font-medium text-ink placeholder:text-grey-strong';
const labelCls = 't-label block text-ink';

export const Field = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string; hint?: string }>(
  function Field({ label, error, hint, id, className = '', ...p }, ref) {
    const fid = id ?? `f-${label.replace(/\W+/g, '-').toLowerCase()}`;
    return (
      <div className="space-y-1.5">
        <label htmlFor={fid} className={labelCls}>{label}</label>
        {hint && <p id={`${fid}-hint`} className="text-sm text-grey-strong">{hint}</p>}
        <input ref={ref} id={fid} aria-invalid={Boolean(error)} aria-describedby={[hint ? `${fid}-hint` : '', error ? `${fid}-err` : ''].join(' ').trim() || undefined}
          className={`${control} ${error ? 'border-danger' : ''} ${className}`} {...p} />
        {error && <p id={`${fid}-err`} role="alert" className="text-sm font-bold text-danger">{error}</p>}
      </div>
    );
  },
);

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement> & { label: string }>(
  function Select({ label, children, id, ...p }, ref) {
    const fid = id ?? `s-${label.replace(/\W+/g, '-').toLowerCase()}`;
    return (
      <div className="space-y-1.5">
        <label htmlFor={fid} className={labelCls}>{label}</label>
        <select ref={ref} id={fid} {...p} className={control}>{children}</select>
      </div>
    );
  },
);

/* ───── states ───── */
export function Spinner({ label }: { label?: string }) {
  const { t } = useI18n();
  return (
    <div role="status" className="py-10">
      <div className="h-px w-40 overflow-hidden bg-line"><div className="h-px w-1/3 animate-[slide_1.2s_ease-in-out_infinite] bg-ink" /></div>
      <p className="t-label mt-3 text-grey-strong">{label ?? t('loading')}</p>
    </div>
  );
}

export function ErrorBox({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const { t } = useI18n();
  const msg = error instanceof Error && error.message ? error.message : t('error.generic');
  return (
    <div role="alert" className="flex items-start gap-4 border border-danger bg-danger-bg p-5 text-danger">
      <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
      <div className="space-y-3"><p className="font-bold">{msg}</p>{onRetry && <Button variant="secondary" onClick={onRetry}>{t('retry')}</Button>}</div>
    </div>
  );
}

export function Empty({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="border border-dashed border-line-strong p-10 text-center">
      <p className="t-display text-display-sm">{title}</p>
      {hint && <p className="mx-auto mt-2 max-w-md text-grey-strong">{hint}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Notice({ tone = 'info', children }: { tone?: 'info' | 'warn' | 'good'; children: ReactNode }) {
  const tones = { info: 'border-line-strong bg-surface', warn: 'border-caution bg-caution-bg text-caution', good: 'border-ok bg-ok-bg text-ok' };
  const Icon = tone === 'warn' ? ShieldAlert : tone === 'good' ? CheckCircle2 : Info;
  return (
    <div role="note" className={`flex items-start gap-3 border-l-4 px-4 py-3 text-[0.95rem] ${tones[tone]}`}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /><div>{children}</div>
    </div>
  );
}

export function StatusBadge({ status }: { status: VerificationStatus }) {
  const { t } = useI18n();
  const verified = status === 'verified';
  const cls = verified ? 'border-ok bg-ok-bg text-ok' : status === 'demonstration' ? 'border-line-strong text-ink' : 'border-caution bg-caution-bg text-caution';
  const Icon = verified ? CheckCircle2 : status === 'demonstration' ? FlaskConical : AlertTriangle;
  return (
    <span className={`t-label inline-flex items-center gap-1.5 border px-2 py-1 text-[0.7rem] ${cls}`}>
      <Icon className="h-3.5 w-3.5" aria-hidden />{t(`status.${status}` as MessageKey)}
    </span>
  );
}

/* ───── headings ───── */
export function PageTitle({ children, sub, eyebrow }: { children: ReactNode; sub?: ReactNode; eyebrow?: string }) {
  return (
    <header className="mb-10 border-t border-line-strong pt-4">
      {eyebrow && <p className="t-label text-grey-strong">{eyebrow}</p>}
      <h1 className="t-display mt-3 text-display-lg">{children}</h1>
      {sub && <p className="mt-5 max-w-2xl text-lg text-grey-strong">{sub}</p>}
    </header>
  );
}

export function SectionHeading({ id, eyebrow, children, className = '' }: { id?: string; eyebrow?: string; children: ReactNode; className?: string }) {
  return (
    <div className={`border-t border-line-strong pt-4 ${className}`}>
      {eyebrow && <p className="t-label text-grey-strong">{eyebrow}</p>}
      <h2 id={id} className="t-display mt-2 text-display-md">{children}</h2>
    </div>
  );
}

export function PageContainer({ children, className = '', narrow = false }: { children: ReactNode; className?: string; narrow?: boolean }) {
  return <div className={`page py-10 lg:py-16 ${narrow ? 'max-w-3xl' : ''} ${className}`}>{children}</div>;
}
