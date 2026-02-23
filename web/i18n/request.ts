import {getRequestConfig} from 'next-intl/server';
import {cookies, headers} from 'next/headers';
import {DEFAULT_LOCALE, getLocaleCookieName, isSupportedLocale, normalizeLanguageTag, type Locale} from '@/lib/i18n';

export default getRequestConfig(async ({locale}) => {
  let resolvedLocale: Locale = isSupportedLocale(locale) ? locale : DEFAULT_LOCALE;

  if (!isSupportedLocale(locale)) {
    const cookieStore = await cookies();
    const cookieLocale = cookieStore.get(getLocaleCookieName())?.value;
    if (isSupportedLocale(cookieLocale)) {
      resolvedLocale = cookieLocale;
    } else {
      const headerStore = await headers();
      const headerLocale = normalizeLanguageTag(headerStore.get('accept-language'));
      if (headerLocale) {
        resolvedLocale = headerLocale;
      }
    }
  }

  return {
    locale: resolvedLocale,
    messages: (await import(`../messages/${resolvedLocale}.json`)).default
  };
});
