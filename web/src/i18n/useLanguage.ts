import { useCallback, useEffect, useState } from 'react';
import { getTranslations, LANG_STORAGE_KEY, type Lang, type Translations } from './translations';

export function useLanguage() {
  const [lang, setLangState] = useState<Lang>(() => {
    const stored = localStorage.getItem(LANG_STORAGE_KEY);
    return stored === 'en' ? 'en' : 'es';
  });

  const t: Translations = getTranslations(lang);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    localStorage.setItem(LANG_STORAGE_KEY, next);
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  return { lang, setLang, t };
}
