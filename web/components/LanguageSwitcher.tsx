'use client';

import {useLocale, useTranslations} from 'next-intl';
import {useSearchParams} from 'next/navigation';
import {SUPPORTED_LOCALES} from '@/lib/i18n';
import {usePathname, useRouter} from '@/i18n/navigation';

const LABELS: Record<string, string> = {
  en: 'EN',
  ar: 'AR',
  cs: 'CS',
  ru: 'RU'
};

export default function LanguageSwitcher() {
  const locale = useLocale();
  const t = useTranslations('common');
  const pathname = usePathname();
  const search = useSearchParams();
  const router = useRouter();

  function setLocale(nextLocale: string) {
    if (nextLocale === locale) return;
    const searchText = search.toString();
    const target = searchText ? `${pathname}?${searchText}` : pathname;
    router.replace(target as any, {locale: nextLocale as any});
    router.refresh();
  }

  return (
    <div className="lang-switcher" role="group" aria-label={t('language')}>
      {SUPPORTED_LOCALES.map((item) => (
        <button
          key={item}
          type="button"
          className={`lang-switcher__btn${item === locale ? ' is-active' : ''}`}
          onClick={() => setLocale(item)}
          aria-pressed={item === locale}
        >
          {LABELS[item] || item.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
