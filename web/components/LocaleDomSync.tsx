'use client';

import {useEffect} from 'react';
import {useLocale} from 'next-intl';
import {DEFAULT_LOCALE, isSupportedLocale, localeToDir} from '@/lib/i18n';

export default function LocaleDomSync() {
  const locale = useLocale();

  useEffect(() => {
    const safeLocale = isSupportedLocale(locale) ? locale : DEFAULT_LOCALE;
    const dir = localeToDir(safeLocale);
    document.documentElement.setAttribute('lang', safeLocale);
    document.documentElement.setAttribute('dir', dir);
    document.body.setAttribute('dir', dir);
  }, [locale]);

  return null;
}
