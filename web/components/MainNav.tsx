'use client';

import Link from 'next/link';
import {useTranslations} from 'next-intl';
import LanguageSwitcher from '@/components/LanguageSwitcher';

export default function MainNav() {
  const t = useTranslations('nav');

  return (
    <header className="site-header">
      <div className="container site-header__inner">
        <Link href="/" className="brand-link">
          CareChair
        </Link>

        <nav className="site-nav" aria-label="Primary navigation">
          <Link href="/" className="site-nav__link">
            {t('home')}
          </Link>
          <Link href="/explore" className="site-nav__link">
            {t('explore')}
          </Link>
        </nav>

        <LanguageSwitcher />
      </div>
    </header>
  );
}
