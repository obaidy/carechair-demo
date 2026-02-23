import createIntlMiddleware from 'next-intl/middleware';
import {NextResponse} from 'next/server';
import type {NextRequest} from 'next/server';
import {routing} from '@/i18n/routing';
import {AUTH_ROLE_COOKIE, canAccessRoute, isWebAuthRole, roleForPath} from '@/lib/auth/session';

const intlMiddleware = createIntlMiddleware(routing);

export default function middleware(request: NextRequest) {
  const {pathname, search} = request.nextUrl;

  if (pathname === '/home' || pathname === '/home/') {
    const targetUrl = request.nextUrl.clone();
    targetUrl.pathname = '/';
    targetUrl.search = '';
    return NextResponse.redirect(targetUrl);
  }

  const localeHomeMatch = pathname.match(/^\/(en|ar|cs|ru)\/home\/?$/i);
  if (localeHomeMatch) {
    const locale = localeHomeMatch[1].toLowerCase();
    const targetUrl = request.nextUrl.clone();
    targetUrl.pathname = `/${locale}`;
    targetUrl.search = '';
    return NextResponse.redirect(targetUrl);
  }

  const localeMatch = pathname.match(/^\/(en|ar|cs|ru)(\/.*)?$/i);
  if (localeMatch) {
    const locale = localeMatch[1].toLowerCase();
    const pathWithoutLocale = localeMatch[2] || '/';
    const requiredRole = roleForPath(pathWithoutLocale);
    const roleValue = request.cookies.get(AUTH_ROLE_COOKIE)?.value;

    if (pathWithoutLocale === '/login' && isWebAuthRole(roleValue)) {
      const targetUrl = request.nextUrl.clone();
      targetUrl.pathname = roleValue === 'superadmin' ? `/${locale}/sa` : `/${locale}/app`;
      targetUrl.search = '';
      return NextResponse.redirect(targetUrl);
    }

    if (requiredRole) {
      if (!isWebAuthRole(roleValue)) {
        const targetUrl = request.nextUrl.clone();
        targetUrl.pathname = `/${locale}/login`;
        targetUrl.searchParams.set('next', `${pathname}${search || ''}`);
        return NextResponse.redirect(targetUrl);
      }

      if (!canAccessRoute(roleValue, requiredRole)) {
        const forbiddenUrl = request.nextUrl.clone();
        forbiddenUrl.pathname = `/${locale}/403`;
        forbiddenUrl.search = '';
        return NextResponse.rewrite(forbiddenUrl);
      }
    }
  }

  return intlMiddleware(request);
}

export const config = {
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)']
};
