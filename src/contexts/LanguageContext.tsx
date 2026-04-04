/**
 * Language Context — Tamil (default) ↔ English toggle for Patient App
 * 
 * Provides:
 *   lang   — current language ('ta' | 'en')
 *   setLang — switch language
 *   t(key) — translate a key to the current language
 */
import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import translations, { type Lang } from '../i18n/patientTranslations';

interface LanguageContextType {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType>({
  lang: 'ta',
  setLang: () => {},
  t: (key: string) => key,
});

export const useLanguage = () => useContext(LanguageContext);

interface Props {
  children: ReactNode;
}

export const LanguageProvider: React.FC<Props> = ({ children }) => {
  const [lang, setLangState] = useState<Lang>(() => {
    try {
      const saved = localStorage.getItem('bh-patient-lang');
      if (saved === 'en' || saved === 'ta') return saved;
    } catch {}
    return 'ta'; // Default to Tamil
  });

  const setLang = useCallback((newLang: Lang) => {
    setLangState(newLang);
    try {
      localStorage.setItem('bh-patient-lang', newLang);
    } catch {}
  }, []);

  const t = useCallback((key: string): string => {
    const entry = translations[key];
    if (!entry) {
      console.warn(`[i18n] Missing translation key: "${key}"`);
      return key;
    }
    return entry[lang] || entry['en'] || key;
  }, [lang]);

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export default LanguageContext;
