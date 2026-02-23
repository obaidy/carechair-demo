'use client';

import {useState} from 'react';
import BrandLogo from '@/components/BrandLogo';
import {Link, usePathname} from '@/i18n/navigation';
import MobileDrawer from '@/components/MobileDrawer';
import {useTx} from '@/lib/messages-client';

type DashboardNavItem = {
  href: string;
  label: string;
};

export default function DashboardNav({
  title,
  items,
  logoutHref
}: {
  title: string;
  items: DashboardNavItem[];
  logoutHref: string;
}) {
  const pathname = usePathname();
  const t = useTx();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="platform-header cc-sticky-nav">
      <div className="platform-header-main">
        <BrandLogo className="platform-brand" to="/" />
        <div className="platform-header-copy">
          <h1>{title}</h1>
        </div>
      </div>

      <button
        type="button"
        className="platform-menu-toggle"
        onClick={() => setMenuOpen((v) => !v)}
        aria-expanded={menuOpen}
        aria-controls="dashboard-mobile-drawer"
      >
        {menuOpen ? '✕' : '☰'}
      </button>

      <div className="header-actions">
        <nav aria-label={t('nav.menu', 'Menu')}>
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href as any}
              className={`ghost-link${pathname === item.href ? ' is-active' : ''}`}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <a className="ghost-link" href={logoutHref}>
          {t('nav.logout', 'Logout')}
        </a>
      </div>

      <MobileDrawer open={menuOpen} onClose={() => setMenuOpen(false)} id="dashboard-mobile-drawer" title={t('nav.menu', 'Menu')}>
        <div className="platform-mobile-drawer-links">
          {items.map((item) => (
            <Link
              key={`mobile-${item.href}`}
              href={item.href as any}
              className={`platform-mobile-link${pathname === item.href ? ' is-active' : ''}`}
              onClick={() => setMenuOpen(false)}
            >
              {item.label}
            </Link>
          ))}
          <a className="platform-mobile-link" href={logoutHref} onClick={() => setMenuOpen(false)}>
            {t('nav.logout', 'Logout')}
          </a>
        </div>
      </MobileDrawer>
    </header>
  );
}
