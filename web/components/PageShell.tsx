'use client';

import {useEffect, useState, type ReactNode} from 'react';
import {useLocale} from 'next-intl';
import {usePathname, useSearchParams} from 'next/navigation';
import BrandLogo from '@/components/BrandLogo';
import MobileDrawer from '@/components/MobileDrawer';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import PublicFooter from '@/components/PublicFooter';
import {Button} from '@/components/ui';
import {Link} from '@/i18n/navigation';
import {useTx} from '@/lib/messages-client';

type PageShellProps = {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  children: ReactNode;
  mobileMenuDisabled?: boolean;
  mobileMenuContent?: ReactNode | ((args: {closeMenu: () => void}) => ReactNode);
};

export default function PageShell({
  title,
  subtitle,
  right,
  children,
  mobileMenuDisabled = false,
  mobileMenuContent = null
}: PageShellProps) {
  const pathname = usePathname();
  const search = useSearchParams();
  const searchKey = search?.toString() || '';
  const locale = useLocale();
  const t = useTx();
  const [menuOpen, setMenuOpen] = useState(false);

  const isSuperadminRoute = pathname.startsWith(`/${locale}/sa`);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname, searchKey]);

  return (
    <div className="platform-page" dir={locale === 'ar' ? 'rtl' : 'ltr'}>
      <header className="platform-header cc-sticky-nav">
        <div className="platform-header-main">
          <BrandLogo className="platform-brand" />
          <div className="platform-header-copy">
            <h1>{title}</h1>
            {subtitle ? <p>{subtitle}</p> : null}
          </div>
        </div>

        {!mobileMenuDisabled ? (
          <button
            type="button"
            className="platform-menu-toggle"
            onClick={() => setMenuOpen((v) => !v)}
            aria-expanded={menuOpen}
            aria-controls="platform-mobile-drawer"
          >
            {menuOpen ? '✕' : '☰'}
          </button>
        ) : null}

        <div className="header-actions">
          <Link className={`ghost-link${pathname === `/${locale}/explore` ? ' is-active' : ''}`} href="/explore">
            {t('common.explore', 'Explore')}
          </Link>
          <Link className="ghost-link" href="/#pricing">
            {t('nav.pricing', 'Pricing')}
          </Link>
          <Link className={`ghost-link${isSuperadminRoute ? ' is-active' : ''}`} href="/sa">
            {t('nav.superadmin', 'Super Admin')}
          </Link>
          <LanguageSwitcher />
          {right}
        </div>
      </header>

      {!mobileMenuDisabled ? (
        <MobileDrawer open={menuOpen} onClose={() => setMenuOpen(false)} id="platform-mobile-drawer" title={t('nav.menu', 'Menu')}>
          {typeof mobileMenuContent === 'function' ? (
            mobileMenuContent({closeMenu: () => setMenuOpen(false)})
          ) : mobileMenuContent ? (
            mobileMenuContent
          ) : (
            <div className="platform-mobile-drawer-links">
              <Link
                className={`platform-mobile-link${pathname === `/${locale}/explore` ? ' is-active' : ''}`}
                href="/explore"
                onClick={() => setMenuOpen(false)}
              >
                {t('common.explore', 'Explore')}
              </Link>
              <Link className="platform-mobile-link" href="/#pricing" onClick={() => setMenuOpen(false)}>
                {t('nav.pricing', 'Pricing')}
              </Link>
              <Link
                className={`platform-mobile-link${isSuperadminRoute ? ' is-active' : ''}`}
                href="/sa"
                onClick={() => setMenuOpen(false)}
              >
                {t('nav.superadmin', 'Super Admin')}
              </Link>
              <LanguageSwitcher className="platform-mobile-lang" onLanguageChange={() => setMenuOpen(false)} />
              {right ? <div className="platform-mobile-extra">{right}</div> : null}
            </div>
          )}
        </MobileDrawer>
      ) : null}

      <main className="platform-main">{children}</main>
      <PublicFooter />
    </div>
  );
}
