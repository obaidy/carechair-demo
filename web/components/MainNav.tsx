'use client';

import {useEffect, useMemo, useState, type MouseEvent} from 'react';
import {useLocale} from 'next-intl';
import {usePathname} from 'next/navigation';
import BrandLogo from '@/components/BrandLogo';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import MobileDrawer from '@/components/MobileDrawer';
import {Link} from '@/i18n/navigation';
import {Button} from '@/components/ui';
import {useTx} from '@/lib/messages-client';

const PLATFORM_WHATSAPP_LINK =
  'https://wa.me/9647700603080?text=%D9%85%D8%B1%D8%AD%D8%A8%D8%A7%20%D8%A7%D8%B1%D9%8A%D8%AF%20%D8%A7%D8%B9%D8%B1%D9%81%20%D8%B9%D9%86%20CareChair';

export default function MainNav() {
  const locale = useLocale();
  const t = useTx();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [activeNavItem, setActiveNavItem] = useState('owners');

  const homePath = `/${locale}`;
  const isHome = pathname === homePath || pathname === `${homePath}/`;

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const syncHash = () => {
      if (!isHome) return;
      const hash = decodeURIComponent(window.location.hash || '').replace(/^#/, '').trim();
      if (hash === 'owners' || hash === 'features' || hash === 'pricing' || hash === 'faq') {
        setActiveNavItem(hash);
      } else if (!hash) {
        setActiveNavItem('owners');
      }
    };
    syncHash();
    window.addEventListener('hashchange', syncHash);
    return () => window.removeEventListener('hashchange', syncHash);
  }, [isHome]);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const sectionLinks = useMemo(
    () => [
      {id: 'owners', label: t('nav.centers', 'For Salons')},
      {id: 'features', label: t('nav.features', 'Features')},
      {id: 'pricing', label: t('nav.pricing', 'Pricing')},
      {id: 'faq', label: t('nav.faq', 'FAQ')}
    ],
    [t]
  );

  function onSectionClick(event: MouseEvent<HTMLAnchorElement>, id: string) {
    setActiveNavItem(id);
    setMobileOpen(false);
    if (!isHome || typeof window === 'undefined') return;
    event.preventDefault();
    const node = document.getElementById(id);
    if (!node) return;
    node.scrollIntoView({behavior: 'smooth', block: 'start'});
    window.history.replaceState(null, '', `${homePath}#${id}`);
  }

  function closeMobile() {
    setMobileOpen(false);
  }

  return (
    <header className="landing-nav cc-sticky-nav">
      <div className="landing-nav-inner cc-container">
        <BrandLogo className="landing-logo-main" to="/" />

        <nav className="landing-links" aria-label={t('nav.menu', 'Menu')}>
          <Link href="/explore" className={`landing-nav-link${pathname.startsWith(`/${locale}/explore`) ? ' active' : ''}`}>
            {t('common.explore', 'Explore')}
          </Link>
          {sectionLinks.map((item) => (
            <a
              key={item.id}
              href={`${homePath}#${item.id}`}
              className={`landing-nav-link${isHome && activeNavItem === item.id ? ' active' : ''}`}
              onClick={(event) => onSectionClick(event, item.id)}
            >
              {item.label}
            </a>
          ))}
        </nav>

        <Button as="a" href={PLATFORM_WHATSAPP_LINK} target="_blank" rel="noreferrer" className="landing-nav-cta">
          {t('common.whatsappDemo', 'WhatsApp Demo')}
        </Button>
        <LanguageSwitcher className="landing-lang-switcher" />

        <button
          type="button"
          className="landing-menu-toggle"
          onClick={() => setMobileOpen((v) => !v)}
          aria-expanded={mobileOpen}
          aria-controls="landing-mobile-menu"
        >
          {mobileOpen ? '✕' : '☰'}
        </button>
      </div>

      <MobileDrawer open={mobileOpen} onClose={() => setMobileOpen(false)} id="landing-mobile-menu" title={t('nav.menu', 'Menu')}>
        <div className="landing-mobile-menu">
          {sectionLinks.map((item) => (
            <a
              key={`m-${item.id}`}
              href={`${homePath}#${item.id}`}
              className={`landing-mobile-link${isHome && activeNavItem === item.id ? ' active' : ''}`}
              onClick={(event) => onSectionClick(event, item.id)}
            >
              {item.label}
            </a>
          ))}
          <Link
            className={`landing-mobile-link${pathname.startsWith(`/${locale}/explore`) ? ' active' : ''}`}
            href="/explore"
            onClick={closeMobile}
          >
            {t('home.ctaExplore', 'Explore Salons')}
          </Link>
          <Button
            as="a"
            href={PLATFORM_WHATSAPP_LINK}
            target="_blank"
            rel="noreferrer"
            className="landing-mobile-link"
            onClick={closeMobile}
          >
            {t('home.ctaMain', 'Request Your System')}
          </Button>
          <LanguageSwitcher className="landing-mobile-link" onLanguageChange={closeMobile} />
        </div>
      </MobileDrawer>
    </header>
  );
}
