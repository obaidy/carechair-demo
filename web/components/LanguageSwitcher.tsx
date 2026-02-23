'use client';

import {useLocale} from 'next-intl';
import {usePathname, useRouter, useSearchParams} from 'next/navigation';
import {SUPPORTED_LOCALES} from '@/lib/i18n';
import {useTx} from '@/lib/messages-client';

const LABELS: Record<string, string> = {
  ar: 'العربية',
  en: 'English',
  cs: 'Čeština',
  ru: 'Русский'
};

type LanguageSwitcherProps = {
  className?: string;
  onLanguageChange?: (lang: string) => void;
};

function replaceLocale(pathname: string, nextLocale: string): string {
  const cleanPath = pathname || '/';
  const parts = cleanPath.split('/').filter(Boolean);
  if (!parts.length) return `/${nextLocale}`;

  const head = parts[0];
  if (SUPPORTED_LOCALES.includes(head as (typeof SUPPORTED_LOCALES)[number])) {
    parts[0] = nextLocale;
    return `/${parts.join('/')}`;
  }

  return `/${nextLocale}/${parts.join('/')}`;
}

export default function LanguageSwitcher({className = '', onLanguageChange}: LanguageSwitcherProps) {
  const locale = useLocale();
  const t = useTx();
  const pathname = usePathname();
  const search = useSearchParams();
  const router = useRouter();

  function setLanguage(nextLocale: string) {
    if (nextLocale === locale) return;

    const searchText = search.toString().trim();
    const nextPath = replaceLocale(pathname, nextLocale);
    router.replace(searchText ? `${nextPath}?${searchText}` : nextPath);
    document.cookie = `cc_locale=${nextLocale}; path=/; max-age=31536000; samesite=lax`;
    onLanguageChange?.(nextLocale);
  }

  return (
    <label className={`lang-switcher ${className}`.trim()}>
      <span>🌐</span>
      <select value={locale} onChange={(event) => setLanguage(event.target.value)} aria-label={t('common.language', 'Language')}>
        {SUPPORTED_LOCALES.map((item) => (
          <option value={item} key={item}>
            {LABELS[item] || item}
          </option>
        ))}
      </select>
    </label>
  );
}
