import {NextResponse} from 'next/server';
import type {NextRequest} from 'next/server';
import {getLocaleCookieName, isSupportedLocale} from '@/lib/i18n';

function normalizePathname(pathname: string): string {
  if (pathname === '/') return pathname;
  return pathname.replace(/\/+$/, '');
}

export default function middleware(request: NextRequest) {
  const normalizedPathname = normalizePathname(request.nextUrl.pathname);
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

  if (normalizedPathname === '/home') {
    const targetUrl = request.nextUrl.clone();
    targetUrl.pathname = '/';
    return NextResponse.redirect(targetUrl);
  }

  const localeHomeMatch = normalizedPathname.match(/^\/(en|ar|cs|ru)\/home$/i);
  if (localeHomeMatch) {
    const targetUrl = request.nextUrl.clone();
    targetUrl.pathname = '/';

    const response = NextResponse.redirect(targetUrl);
    response.cookies.set(getLocaleCookieName(), localeHomeMatch[1].toLowerCase(), {
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
      sameSite: 'lax'
    });
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)']
};
