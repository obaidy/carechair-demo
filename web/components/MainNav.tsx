'use client';

import {useMemo, useState} from 'react';
import {useLocale, useTranslations} from 'next-intl';
import BrandLogo from '@/components/BrandLogo';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import {Link, usePathname} from '@/i18n/navigation';

function isHomePath(pathname: string): boolean {
  return /^\/(en|ar|cs|ru)\/?$/.test(pathname);
}

export default function MainNav() {
  const locale = useLocale();
  const t = useTranslations();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const links = useMemo(
    () => [
      {href: '/', label: t('nav.home', {defaultValue: 'Home'}), active: isHomePath(pathname)},
      {href: '/explore', label: t('nav.explore', {defaultValue: 'Explore'}), active: pathname.startsWith(`/${locale}/explore`)},
      {href: '/login', label: t('nav.login', {defaultValue: 'Login'}), active: pathname.startsWith(`/${locale}/login`)}
    ],
    [locale, pathname, t]
  );

  const sectionLinks = [
    {id: 'owners', label: t('nav.centers', {defaultValue: 'For salons'})},
    {id: 'features', label: t('nav.features', {defaultValue: 'Features'})},
    {id: 'pricing', label: t('nav.pricing', {defaultValue: 'Pricing'})},
    {id: 'faq', label: t('nav.faq', {defaultValue: 'FAQ'})}
  ];

  function closeMobile() {
    setMobileOpen(false);
  }

  return (
    <header className="site-header cc-sticky-nav">
      <div className="container site-header__inner">
        <BrandLogo className="site-brand" href="/" />

        <nav className="site-nav-desktop" aria-label={t('nav.menu', {defaultValue: 'Menu'})}>
          {links.map((item) => (
            <Link key={item.href} href={item.href as any} className={`ghost-link${item.active ? ' is-active' : ''}`}>
              {item.label}
            </Link>
          ))}
          {sectionLinks.map((item) => (
            <a key={item.id} href={`/${locale}/#${item.id}`} className="ghost-link">
              {item.label}
            </a>
          ))}
        </nav>

        <div className="header-actions">
          <LanguageSwitcher />
          <button
            type="button"
            className="menu-toggle"
            onClick={() => setMobileOpen((v) => !v)}
            aria-expanded={mobileOpen}
            aria-controls="public-mobile-menu"
          >
            {mobileOpen ? '✕' : '☰'}
          </button>
        </div>
      </div>

      {mobileOpen ? (
        <div id="public-mobile-menu" className="mobile-menu-panel" role="dialog" aria-modal="false">
          <div className="mobile-menu-panel__inner">
            {links.map((item) => (
              <Link
                key={`mobile-${item.href}`}
                href={item.href as any}
                className={`mobile-link${item.active ? ' is-active' : ''}`}
                onClick={closeMobile}
              >
                {item.label}
              </Link>
            ))}
            {sectionLinks.map((item) => (
              <a key={`mobile-${item.id}`} href={`/${locale}/#${item.id}`} className="mobile-link" onClick={closeMobile}>
                {item.label}
              </a>
            ))}
          </div>
        </div>
      ) : null}
    </header>
  );
}
