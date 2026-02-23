export const SUPPORTED_LOCALES = ['en', 'ar', 'cs', 'ru'] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'en';
const LOCALE_COOKIE = 'cc_locale';

export function isSupportedLocale(value: string | null | undefined): value is Locale {
  if (!value) return false;
  return SUPPORTED_LOCALES.includes(value as Locale);
}

export function localeToDir(locale: Locale): 'ltr' | 'rtl' {
  return locale === 'ar' ? 'rtl' : 'ltr';
}

export function normalizeLanguageTag(raw: string | null | undefined): Locale | null {
  const trimmed = String(raw || '').trim().toLowerCase();
  if (!trimmed) return null;

  const base = trimmed.split(',')[0]?.split(';')[0]?.split('-')[0] || '';
  if (isSupportedLocale(base)) return base;
  return null;
}

export function getLocaleCookieName(): string {
  return LOCALE_COOKIE;
}
