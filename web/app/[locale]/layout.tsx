import {NextIntlClientProvider} from 'next-intl';
import {getMessages} from 'next-intl/server';
import {notFound} from 'next/navigation';
import RouteScrollManager from '@/components/RouteScrollManager';
import {isSupportedLocale, localeToDir, SUPPORTED_LOCALES} from '@/lib/i18n';

export function generateStaticParams() {
  return SUPPORTED_LOCALES.map((locale) => ({locale}));
}

export default async function LocaleLayout({
  children,
  params
}: {
  children: React.ReactNode;
  params: Promise<{locale: string}>;
}) {
  const {locale} = await params;
  if (!isSupportedLocale(locale)) notFound();

  const messages = await getMessages({locale});

  return (
    <div className="locale-shell" lang={locale} dir={localeToDir(locale)}>
      <NextIntlClientProvider locale={locale} messages={messages}>
        <RouteScrollManager />
        {children}
      </NextIntlClientProvider>
    </div>
  );
}
