import { createContext, useContext, useState, useEffect, useCallback, useMemo, type ReactNode } from 'react';
import { escHtml } from '../lib/util';

type Locale = Record<string, string>;

interface I18nContextValue {
  t: (key: string, fallback?: string) => string;
  tReplace: (key: string, replacements: Record<string, string | number>) => string;
  loaded: boolean;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<Locale>({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const lang = navigator.language || 'en';
    const short = lang.split('-')[0];
    const candidates = [lang, short, 'en'];

    (async () => {
      for (const candidate of candidates) {
        try {
          const res = await fetch(`/locales/${candidate}.json`);
          if (res.ok) {
            const data = await res.json();
            if (Object.keys(data).length > 0) {
              setLocale(data);
              setLoaded(true);
              return;
            }
          }
        } catch { /* try next */ }
      }
      setLoaded(true);
    })();
  }, []);

  const t = useCallback((key: string, fallback?: string): string => {
    return locale[key] || fallback || key;
  }, [locale]);

  const tReplace = useCallback((key: string, replacements: Record<string, string | number>): string => {
    let str = locale[key] || key;
    for (const k in replacements) {
      str = str.replace(`{${k}}`, escHtml(String(replacements[k])));
    }
    return str;
  }, [locale]);

  const value = useMemo(() => ({ t, tReplace, loaded }), [t, tReplace, loaded]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within I18nProvider');
  return ctx;
}
