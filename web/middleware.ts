import createMiddleware from 'next-intl/middleware';
import {NextResponse} from 'next/server';
import type {NextRequest} from 'next/server';
import {DEFAULT_LOCALE, getLocaleCookieName, isSupportedLocale, SUPPORTED_LOCALES} from '@/lib/i18n';

const handleI18nRouting = createMiddleware({
  locales: [...SUPPORTED_LOCALES],
  defaultLocale: DEFAULT_LOCALE,
  localePrefix: 'never',
  localeCookie: {
    name: getLocaleCookieName(),
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax'
  }
});

export default function middleware(request: NextRequest) {
  const localeFromQuery = request.nextUrl.searchParams.get('lang');

  if (isSupportedLocale(localeFromQuery)) {
    const targetUrl = request.nextUrl.clone();
    targetUrl.searchParams.delete('lang');

    const response = NextResponse.redirect(targetUrl);
    response.cookies.set(getLocaleCookieName(), localeFromQuery, {
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
      sameSite: 'lax'
    });

    return response;
  }

  return handleI18nRouting(request);
}

export const config = {
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)']
};
