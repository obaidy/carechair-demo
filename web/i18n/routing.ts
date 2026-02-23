import {defineRouting} from 'next-intl/routing';
import {DEFAULT_LOCALE, getLocaleCookieName, SUPPORTED_LOCALES} from '@/lib/i18n';

export const routing = defineRouting({
  locales: [...SUPPORTED_LOCALES],
  defaultLocale: DEFAULT_LOCALE,
  localePrefix: 'always',
  localeCookie: {
    name: getLocaleCookieName(),
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax'
  }
});
