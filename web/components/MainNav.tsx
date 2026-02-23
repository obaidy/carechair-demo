'use client';

import {useTranslations} from 'next-intl';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import BrandLogo from '@/components/BrandLogo';
import {Link, usePathname} from '@/i18n/navigation';

export default function MainNav() {
  const t = useTranslations('nav');
  const pathname = usePathname();

  return (
    <header className="site-header cc-sticky-nav">
      <div className="container site-header__inner">
        <div className="site-header-main">
          <BrandLogo className="site-brand" />
        </div>

        <div className="header-actions">
          <Link href="/" className={`ghost-link${pathname === '/' ? ' is-active' : ''}`}>
            {t('home')}
          </Link>
          <Link href="/explore" className={`ghost-link${pathname === '/explore' ? ' is-active' : ''}`}>
            {t('explore')}
          </Link>
          <LanguageSwitcher />
        </div>
      </div>
    </header>
  );
}
