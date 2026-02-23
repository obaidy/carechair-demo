import {cookies} from 'next/headers';
import {DEFAULT_LOCALE, getLocaleCookieName, isSupportedLocale, localeToDir, type Locale} from '@/lib/i18n';
import './globals.css';

export default async function RootLayout({children}: {children: React.ReactNode}) {
  const jar = await cookies();
  const cookieLocale = jar.get(getLocaleCookieName())?.value;
  const locale: Locale = isSupportedLocale(cookieLocale) ? cookieLocale : DEFAULT_LOCALE;

  return (
    <html lang={locale} dir={localeToDir(locale)} suppressHydrationWarning>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
