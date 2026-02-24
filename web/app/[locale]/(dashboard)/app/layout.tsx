import {redirect} from 'next/navigation';
import DashboardNav from '@/components/DashboardNav';
import {readAuthSession} from '@/lib/auth/server';
import {getMessages, tx} from '@/lib/messages';
import type {Locale} from '@/lib/i18n';

type Props = {
  children: React.ReactNode;
  params: Promise<{locale: string}>;
};

export default async function SalonDashboardLayout({children, params}: Props) {
  const {locale} = await params;
  const session = await readAuthSession();
  if (!session || session.role !== 'salon_admin' || !session.salonId) {
    redirect(`/${locale}/login?error=session`);
  }

  const messages = await getMessages(locale as Locale);

  const items = [
    {href: '/app', label: tx(messages, 'dashboard.overview', 'Overview')},
    {href: '/app/bookings', label: tx(messages, 'dashboard.bookings', 'Bookings')},
    {href: '/app/calendar', label: tx(messages, 'dashboard.calendar', 'Calendar')},
    {href: '/app/staff', label: tx(messages, 'dashboard.staff', 'Staff')},
    {href: '/app/services', label: tx(messages, 'dashboard.services', 'Services')},
    {href: '/app/clients', label: tx(messages, 'dashboard.clients', 'Clients')},
    {href: '/app/settings', label: tx(messages, 'dashboard.settings', 'Settings')}
  ];

  return (
    <div className="platform-page">
      <DashboardNav
        title={tx(messages, 'dashboard.salonTitle', 'Salon Admin')}
        items={items}
        logoutHref={`/api/auth/logout?next=/${locale}/login`}
      />
      <main className="platform-main">{children}</main>
    </div>
  );
}
