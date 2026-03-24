import React, { createContext, useContext, useState, useEffect } from 'react';
import { Language, translations, TranslationKey } from '../i18n/translations';

interface LanguageContextValue {
  language: Language;
  t: TranslationKey;
  toggleLanguage: () => void;
  isTamil: boolean;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguage] = useState<Language>(() => {
    return (localStorage.getItem('bh_language') as Language) || 'en';
  });

  useEffect(() => {
    localStorage.setItem('bh_language', language);
    // Apply Tamil font to html element when Tamil is active
    if (language === 'ta') {
      document.documentElement.style.fontFamily = "'Noto Sans Tamil', system-ui, sans-serif";
    } else {
      document.documentElement.style.fontFamily = '';
    }
  }, [language]);

  const toggleLanguage = () => setLanguage(prev => prev === 'en' ? 'ta' : 'en');

  return (
    <LanguageContext.Provider value={{
      language,
      t: translations[language] as TranslationKey,
      toggleLanguage,
      isTamil: language === 'ta',
    }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = (): LanguageContextValue => {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used within LanguageProvider');
  return ctx;
};
