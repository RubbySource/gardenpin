// i18next setup — detection order: localStorage > browser language > cs default.
// Source of truth for keys = cs.json; en.json is fully translated; de/pl/sk fall back
// to cs until the "Překlady" backlog item fills them.
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import cs from './locales/cs.json';
import en from './locales/en.json';
import de from './locales/de.json';
import pl from './locales/pl.json';
import sk from './locales/sk.json';

export const SUPPORTED_LANGS = ['cs', 'en', 'de', 'pl', 'sk'];

// jazyk → BCP-47 locale pro Intl / toLocaleDateString
const LOCALE_MAP = {
  cs: 'cs-CZ',
  en: 'en-US',
  de: 'de-DE',
  pl: 'pl-PL',
  sk: 'sk-SK',
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      cs: { translation: cs },
      en: { translation: en },
      de: { translation: de },
      pl: { translation: pl },
      sk: { translation: sk },
    },
    fallbackLng: 'cs',
    supportedLngs: SUPPORTED_LANGS,
    nonExplicitSupportedLngs: true, // 'cs-CZ' z prohlížeče → 'cs'
    load: 'languageOnly',
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: 'gardenpin.lang',
      caches: ['localStorage'],
    },
    interpolation: {
      escapeValue: false, // React už escapuje
    },
    returnEmptyString: false,
  });

// Drž <html lang> synchronizovaný s aktivním jazykem (a11y + výchozí Intl).
function syncHtmlLang(lng) {
  const base = (lng || 'cs').split('-')[0];
  document.documentElement.lang = SUPPORTED_LANGS.includes(base) ? base : 'cs';
}
syncHtmlLang(i18n.resolvedLanguage || i18n.language);
i18n.on('languageChanged', syncHtmlLang);

// BCP-47 kód aktivního jazyka pro datum/čas formátování.
export function localeCode() {
  const base = (i18n.resolvedLanguage || i18n.language || 'cs').split('-')[0];
  return LOCALE_MAP[base] || 'cs-CZ';
}

export default i18n;
