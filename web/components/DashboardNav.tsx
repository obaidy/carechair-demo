'use client';

import BrandLogo from '@/components/BrandLogo';
import {Link, usePathname} from '@/i18n/navigation';
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

  return (
    <header className="dashboard-header cc-sticky-nav">
      <div className="container dashboard-header__inner">
        <div className="dashboard-brand-wrap">
          <BrandLogo className="site-brand" to="/" />
          <strong className="dashboard-title">{title}</strong>
        </div>

        <nav className="dashboard-tabs" aria-label={t('nav.menu', 'Menu')}>
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href as any}
              className={`dash-tab${pathname === item.href ? ' is-active' : ''}`}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <a className="ghost-link" href={logoutHref}>
          {t('nav.logout', 'Logout')}
        </a>
      </div>
    </header>
  );
}
