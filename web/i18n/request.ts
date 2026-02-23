import {getRequestConfig} from 'next-intl/server';
import {DEFAULT_LOCALE, isSupportedLocale, type Locale} from '@/lib/i18n';

export default getRequestConfig(async ({locale}) => {
  const resolvedLocale: Locale = isSupportedLocale(locale) ? locale : DEFAULT_LOCALE;

  return {
    locale: resolvedLocale,
    messages: (await import(`../messages/${resolvedLocale}.json`)).default
  };
});
