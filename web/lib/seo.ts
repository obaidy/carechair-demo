import type {Metadata} from 'next';
import {DEFAULT_LOCALE, type Locale, SUPPORTED_LOCALES} from '@/lib/i18n';

export const SITE_NAME = 'CareChair';

export function getBaseUrl(): string {
  const env = String(process.env.NEXT_PUBLIC_SITE_URL || '').trim();
  if (!env) return 'http://localhost:3000';
  return env.endsWith('/') ? env.slice(0, -1) : env;
}

export function localizedPath(locale: Locale, pathname: string): string {
  const safePath = pathname.startsWith('/') ? pathname : `/${pathname}`;
  if (safePath === '/') return `/${locale}`;
  return `/${locale}${safePath}`;
}

export function toAbsoluteUrl(pathname: string): string {
  const safePath = pathname.startsWith('/') ? pathname : `/${pathname}`;
  return `${getBaseUrl()}${safePath}`;
}

export function localeAlternateUrls(pathname: string): Record<Locale, string> {
  const map = {} as Record<Locale, string>;
  for (const locale of SUPPORTED_LOCALES) {
    map[locale] = toAbsoluteUrl(localizedPath(locale, pathname));
  }
  return map;
}

export function buildMetadata({
  title,
  description,
  pathname
}: {
  title: string;
  description: string;
  pathname: string;
}): Metadata {
  const canonicalPath = localizedPath(DEFAULT_LOCALE, pathname);
  const canonical = toAbsoluteUrl(canonicalPath);

  return {
    title,
    description,
    alternates: {
      canonical,
      languages: localeAlternateUrls(pathname)
    },
    openGraph: {
      title,
      description,
      url: canonical,
      siteName: SITE_NAME,
      type: 'website'
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description
    }
  };
}
