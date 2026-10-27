import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import en, { type MessageKey } from './en';
import hi from './hi';

export type Lang = 'en' | 'hi';
// Add more languages here (e.g. ta, bn) by registering another partial dictionary.
const dictionaries: Record<Lang, Partial<Record<MessageKey, string>>> = { en, hi };

interface I18n {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: MessageKey) => string;
  /** true when the key has no translation in the active language and English is shown instead */
  missing: (key: MessageKey) => boolean;
}

const Ctx = createContext<I18n | null>(null);

function initialLang(): Lang {
  try {
    const stored = localStorage.getItem('lang');
    if (stored === 'en' || stored === 'hi') return stored;
  } catch { /* storage unavailable */ }
  return 'en';
}

export function translate(lang: Lang, key: MessageKey): string {
  return dictionaries[lang][key] ?? en[key];
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initialLang);
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);
  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try { localStorage.setItem('lang', l); } catch { /* ignore */ }
  }, []);
  const value = useMemo<I18n>(
    () => ({
      lang,
      setLang,
      t: (key) => translate(lang, key),
      missing: (key) => lang !== 'en' && !dictionaries[lang][key],
    }),
    [lang, setLang],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useI18n(): I18n {
  const c = useContext(Ctx);
  if (!c) throw new Error('useI18n must be used inside I18nProvider');
  return c;
}
