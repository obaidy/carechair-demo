'use client';

import {useLocale, useTranslations} from 'next-intl';
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
  const router = useRouter();

  function setLocale(nextLocale: string) {
    if (nextLocale === locale) return;

    document.cookie = `cc_locale=${nextLocale}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
    router.replace(pathname);
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
        >
          {LABELS[item] || item.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
