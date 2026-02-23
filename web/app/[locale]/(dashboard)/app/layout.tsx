import {getTranslations} from 'next-intl/server';
import DashboardNav from '@/components/DashboardNav';

type Props = {
  children: React.ReactNode;
  params: Promise<{locale: string}>;
};

export default async function SalonDashboardLayout({children, params}: Props) {
  const {locale} = await params;
  const t = await getTranslations();

  const items = [
    {href: `/${locale}/app`, label: t('dashboard.overview', {defaultValue: 'Overview'})},
    {href: `/${locale}/app/bookings`, label: t('dashboard.bookings', {defaultValue: 'Bookings'})},
    {href: `/${locale}/app/calendar`, label: t('dashboard.calendar', {defaultValue: 'Calendar'})},
    {href: `/${locale}/app/staff`, label: t('dashboard.staff', {defaultValue: 'Staff'})},
    {href: `/${locale}/app/services`, label: t('dashboard.services', {defaultValue: 'Services'})},
    {href: `/${locale}/app/clients`, label: t('dashboard.clients', {defaultValue: 'Clients'})},
    {href: `/${locale}/app/settings`, label: t('dashboard.settings', {defaultValue: 'Settings'})}
  ];

  return (
    <div className="platform-page">
      <DashboardNav
        title={t('dashboard.salonTitle', {defaultValue: 'Salon Admin'})}
        items={items}
        logoutHref={`/api/auth/logout?next=/${locale}/login`}
      />
      <main className="platform-main">{children}</main>
    </div>
  );
}
