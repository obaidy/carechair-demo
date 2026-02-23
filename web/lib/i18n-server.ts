import 'server-only';
import {cookies, headers} from 'next/headers';
import {DEFAULT_LOCALE, type Locale, getLocaleCookieName, normalizeLanguageTag} from '@/lib/i18n';

export async function detectLocale(): Promise<Locale> {
  const cookieStore = await cookies();
  const cookieLocale = normalizeLanguageTag(cookieStore.get(getLocaleCookieName())?.value);
  if (cookieLocale) return cookieLocale;

  const headerStore = await headers();
  const headerLocale = normalizeLanguageTag(headerStore.get('accept-language'));
  if (headerLocale) return headerLocale;

  return DEFAULT_LOCALE;
}
