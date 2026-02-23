import type {Metadata} from 'next';
import type {Locale} from '@/lib/i18n';

export const SITE_NAME = 'CareChair';

export function getBaseUrl(): string {
  const env = String(process.env.NEXT_PUBLIC_SITE_URL || '').trim();
  if (!env) return 'http://localhost:3000';
  return env.endsWith('/') ? env.slice(0, -1) : env;
}

export function toAbsoluteUrl(pathname: string): string {
  const safePath = pathname.startsWith('/') ? pathname : `/${pathname}`;
  return `${getBaseUrl()}${safePath}`;
}

export function localeAlternateUrls(pathname: string): Record<Locale, string> {
  const safePath = pathname.startsWith('/') ? pathname : `/${pathname}`;
  const base = getBaseUrl();
  return {
    en: `${base}${safePath}?lang=en`,
    ar: `${base}${safePath}?lang=ar`,
    cs: `${base}${safePath}?lang=cs`,
    ru: `${base}${safePath}?lang=ru`
  };
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
  const canonical = toAbsoluteUrl(pathname);
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
