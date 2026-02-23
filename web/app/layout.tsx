import type {Metadata} from 'next';
import {NextIntlClientProvider} from 'next-intl';
import {getLocale, getMessages} from 'next-intl/server';
import MainNav from '@/components/MainNav';
import ScrollTopOnPath from '@/components/ScrollTopOnPath';
import {DEFAULT_LOCALE, isSupportedLocale, localeToDir, type Locale} from '@/lib/i18n';
import {t} from '@/lib/messages';
import {buildMetadata} from '@/lib/seo';
import './globals.css';

export async function generateMetadata(): Promise<Metadata> {
  const messages = await getMessages();

  return buildMetadata({
    title: `CareChair | ${t(messages, 'meta.defaultTitle', 'Salon booking platform')}`,
    description: t(messages, 'meta.defaultDescription', 'Find salons and book instantly.'),
    pathname: '/'
  });
}

export default async function RootLayout({children}: {children: React.ReactNode}) {
  const localeRaw = await getLocale();
  const locale: Locale = isSupportedLocale(localeRaw) ? localeRaw : DEFAULT_LOCALE;
  const messages = await getMessages();

  return (
    <html lang={locale} dir={localeToDir(locale)}>
      <body>
        <NextIntlClientProvider locale={locale} messages={messages}>
          <ScrollTopOnPath />
          <MainNav />
          <main className="site-main">{children}</main>
          <footer className="site-footer">
            <div className="container">
              <p>CareChair</p>
            </div>
          </footer>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
