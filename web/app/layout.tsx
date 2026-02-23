import {cookies} from 'next/headers';
import {Cairo, IBM_Plex_Sans_Arabic, Noto_Sans_Arabic} from 'next/font/google';
import {DEFAULT_LOCALE, getLocaleCookieName, isSupportedLocale, localeToDir, type Locale} from '@/lib/i18n';
import './globals.css';

const ibmPlexSansArabic = IBM_Plex_Sans_Arabic({
  subsets: ['arabic', 'latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap'
});

const cairo = Cairo({
  subsets: ['arabic', 'latin'],
  weight: ['400', '500', '600', '700', '800'],
  display: 'swap'
});

const notoSansArabic = Noto_Sans_Arabic({
  subsets: ['arabic'],
  weight: ['400', '500', '600', '700'],
  display: 'swap'
});

export const metadata = {
  icons: {
    icon: '/favicon.png',
    shortcut: '/favicon.png',
    apple: '/apple-touch-icon.png'
  }
};

export default async function RootLayout({children}: {children: React.ReactNode}) {
  const jar = await cookies();
  const cookieLocale = jar.get(getLocaleCookieName())?.value;
  const locale: Locale = isSupportedLocale(cookieLocale) ? cookieLocale : DEFAULT_LOCALE;

  return (
    <html lang={locale} dir={localeToDir(locale)} suppressHydrationWarning>
      <body
        suppressHydrationWarning
        style={{
          fontFamily: `${ibmPlexSansArabic.style.fontFamily}, ${cairo.style.fontFamily}, ${notoSansArabic.style.fontFamily}, ui-sans-serif, system-ui, -apple-system, sans-serif`
        }}
      >
        {children}
      </body>
    </html>
  );
}
