import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import type { Language, LanguagePreference } from '@shared/types'
import { SUPPORTED_LANGUAGES } from '@shared/types'
import en from './locales/en'
import es from './locales/es'
import ptBR from './locales/pt-BR'

/** Maps an OS locale such as `pt-PT`, `es-MX` or `en-GB` to a supported language. */
export function resolveSystemLanguage(locale: string): Language {
  const lower = locale.toLowerCase()
  if (lower.startsWith('pt')) return 'pt-BR'
  if (lower.startsWith('es')) return 'es'
  return 'en'
}

export function resolveLanguage(pref: LanguagePreference, systemLocale: string): Language {
  return pref === 'system' ? resolveSystemLanguage(systemLocale) : pref
}

void i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    'pt-BR': { translation: ptBR },
    es: { translation: es }
  },
  lng: resolveSystemLanguage(navigator.language),
  fallbackLng: 'en',
  supportedLngs: [...SUPPORTED_LANGUAGES],
  interpolation: { escapeValue: false }
})

export default i18n

/** Raw message catalogs, useful when structured (non-string) values are needed. */
export const catalogs = { en, 'pt-BR': ptBR, es } as const

export function currentLanguage(): Language {
  const lng = i18n.resolvedLanguage ?? i18n.language
  return (SUPPORTED_LANGUAGES as readonly string[]).includes(lng) ? (lng as Language) : 'en'
}
