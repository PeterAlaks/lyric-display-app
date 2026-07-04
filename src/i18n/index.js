import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from './locales/en.json';
import es from './locales/es.json';
import fr from './locales/fr.json';

export const DEFAULT_LANGUAGE = 'en';

export const SUPPORTED_LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Spanish' },
  { code: 'fr', label: 'French' },
];

const resources = {
  en: { translation: en },
  es: { translation: es },
  fr: { translation: fr },
};

export const normalizeLanguageCode = (language) => {
  if (typeof language !== 'string') return DEFAULT_LANGUAGE;
  const normalized = language.trim().toLowerCase();
  return SUPPORTED_LANGUAGES.some((item) => item.code === normalized) ? normalized : DEFAULT_LANGUAGE;
};

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: DEFAULT_LANGUAGE,
    fallbackLng: DEFAULT_LANGUAGE,
    interpolation: {
      escapeValue: false,
    },
    react: {
      useSuspense: false,
    },
  });

i18n.on('languageChanged', (language) => {
  if (typeof document !== 'undefined') {
    document.documentElement.lang = normalizeLanguageCode(language);
  }
});

export default i18n;
