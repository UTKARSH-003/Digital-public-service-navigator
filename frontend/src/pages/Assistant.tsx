import { useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Send } from 'lucide-react';
import { api, ApiError } from '../services/api';
import type { AssistantReply } from '../types';
import { useI18n } from '../i18n';
import { ExternalLink, Notice, PageContainer, PageTitle, StatusBadge } from '../components/ui';
import { safeHref } from '../utils';

interface Turn { role: 'user' | 'bot'; text: string; reply?: AssistantReply; error?: boolean }
const EXAMPLES = ['Which scholarships can I apply for?', 'What documents do I need for an income certificate?', 'Which programs may support a small business?'];

/** Minimal, safe rendering: **bold** only, no HTML injection. */
function Rich({ text }: { text: string }) {
  return <>{text.split('\n').map((line, i) => <p key={i} className="mb-1">{line.split(/(\*\*[^*]+\*\*)/g).map((p, j) => p.startsWith('**') ? <strong key={j}>{p.slice(2, -2)}</strong> : <span key={j}>{p}</span>)}</p>)}</>;
}

export default function Assistant() {
  const { t, lang } = useI18n();
  const [turns, setTurns] = useState<Turn[]>([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const ask = async (message: string) => {
    if (!message.trim() || busy) return;
    setTurns((x) => [...x, { role: 'user', text: message }]);
    setText(''); setBusy(true);
    try {
      const r = await api<{ data: AssistantReply }>('/api/assistant/query', { method: 'POST', body: { message, language: lang } });
      setTurns((x) => [...x, { role: 'bot', text: r.data.answer, reply: r.data }]);
    } catch (e) {
      setTurns((x) => [...x, { role: 'bot', error: true, text: e instanceof ApiError && e.status === 429 ? 'You are asking too quickly. Please wait a moment.' : t('error.generic') }]);
    } finally { setBusy(false); setTimeout(() => endRef.current?.scrollIntoView({ block: 'end' }), 50); }
  };
  const submit = (e: FormEvent) => { e.preventDefault(); void ask(text); };

  return (
    <PageContainer narrow>
      <PageTitle eyebrow="Assistant" sub={t('assist.intro')}>{t('assist.title')}</PageTitle>
      <Notice tone="warn">{t('assist.warning')}</Notice>
      <div className="my-8 space-y-6" aria-live="polite" aria-relevant="additions">
        {turns.length === 0 && <div><p className="t-label mb-3 text-grey-strong">{t('assist.examples')}</p><ul className="space-y-3">{EXAMPLES.map((e) => <li key={e}><button type="button" onClick={() => void ask(e)} className="w-full border border-line-strong bg-transparent px-5 py-4 text-left text-lg font-bold transition-colors duration-fast hover:bg-surface">{e}</button></li>)}</ul></div>}
        {turns.map((m, i) => (
          <div key={i} className={m.role === 'user' ? 'ml-auto max-w-[85%] break-words bg-dark p-4 text-paper' : `break-words border p-5 ${m.error ? 'border-danger bg-danger-bg' : 'border-line-strong bg-surface'}`}>
            <span className="sr-only">{m.role === 'user' ? 'You' : 'Assistant'}:</span>
            {m.role === 'user' ? <p>{m.text}</p> : <Rich text={m.text} />}
            {m.reply && (<div className="mt-4 space-y-4 border-t border-line pt-4 text-sm">
              {m.reply.clarifying_question && <p className="font-bold">{m.reply.clarifying_question}</p>}
              {!m.reply.verified && m.reply.services.length > 0 && <Notice tone="warn">{t('status.hint.unverified')}</Notice>}
              {m.reply.services.length > 0 && <ul className="space-y-2">{m.reply.services.map((s) => <li key={s.id} className="flex flex-wrap items-center gap-3"><Link className="font-bold underline" to={`/services/${s.slug}`}>{s.name}</Link><StatusBadge status={s.verification_status} /></li>)}</ul>}
              {m.reply.citations.length > 0 && <div><p className="t-label mb-1">{t('assist.sources')}</p><ul className="space-y-1">{m.reply.citations.map((c) => { const h = safeHref(c.url); return <li key={c.url + c.service_id}>{h ? <ExternalLink href={h}>{c.title}</ExternalLink> : c.title}</li>; })}</ul></div>}
              {m.reply.related.length > 0 && <p><span className="t-label">{t('assist.related')}: </span>{m.reply.related.map((r) => r.name).join(', ')}</p>}
              <p className="text-xs text-grey-strong">{m.reply.mode === 'ai' ? 'Explanation written by AI from our records. ' : ''}{m.reply.notice}</p>
            </div>)}
          </div>))}
        {busy && <p role="status" className="t-label text-grey-strong">{t('loading')}</p>}
        <div ref={endRef} />
      </div>
      <form onSubmit={submit} className="sticky bottom-4 flex border border-dark bg-surface">
        <label htmlFor="ask" className="sr-only">{t('assist.placeholder')}</label>
        <input id="ask" value={text} onChange={(e) => setText(e.target.value)} maxLength={500} placeholder={t('assist.placeholder')} className="min-h-[56px] min-w-0 flex-1 bg-transparent px-5 text-lg placeholder:text-grey-strong focus-visible:outline-offset-[-3px]" />
        <button type="submit" disabled={busy || text.trim().length < 2} className="t-label inline-flex min-h-[56px] shrink-0 items-center gap-2 bg-dark px-4 sm:px-6 text-paper transition-colors duration-fast hover:bg-ink disabled:opacity-40 focus-visible:outline-offset-[-6px] focus-visible:outline-paper"><Send className="h-4 w-4" aria-hidden />{t('assist.send')}</button>
      </form>
    </PageContainer>
  );
}
