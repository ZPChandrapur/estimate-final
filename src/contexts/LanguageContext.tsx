import React, { createContext, useContext } from 'react';
import { useTranslation } from 'react-i18next';
import { LanguageContextType } from '../types';

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};

interface LanguageProviderProps {
  children: React.ReactNode;
}

export const LanguageProvider: React.FC<LanguageProviderProps> = ({ children }) => {
  const { i18n, t } = useTranslation();

  const changeLanguage = (lang: string) => {
    i18n.changeLanguage(lang);
  };

  const value = {
    language: i18n.language,
    changeLanguage,
    t,
  };

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
};