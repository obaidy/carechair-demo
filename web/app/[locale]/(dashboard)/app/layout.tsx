import {redirect} from 'next/navigation';
import DashboardNav from '@/components/DashboardNav';
import {readAuthSession} from '@/lib/auth/server';
import {Link} from '@/i18n/navigation';
import {getSessionSalon} from '@/lib/data/dashboard';
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
  const salon = await getSessionSalon();
  if (!salon) {
    redirect(`/${locale}/login?error=session`);
  }

  const messages = await getMessages(locale as Locale);
  const isPendingApproval = String(salon.status || '').trim() === 'pending_approval';

  const items = isPendingApproval ? [] : [
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
      <main className="platform-main">
        {isPendingApproval ? (
          <div className="cc-section">
            <section className="panel hero-lite">
              <h2>{salon.name}</h2>
              <p>{tx(messages, 'billingAccess.lockMessages.pendingApproval', 'Your salon is waiting for superadmin approval.')}</p>
            </section>

            <section className="panel">
              <p className="muted">
                <strong>{tx(messages, 'status.pending_approval', 'Pending Approval')}</strong>
              </p>
              <p className="muted">{tx(messages, 'billingGate.lockedText', 'Your account is not active. Please complete trial/subscription setup in billing.')}</p>
              <div className="row-actions">
                <Link href="/" className="btn btn-secondary">{tx(messages, 'common.explore', 'Explore')}</Link>
                <a className="btn btn-primary" href={`/api/auth/logout?next=/${locale}/login`}>
                  {tx(messages, 'nav.logout', 'Logout')}
                </a>
              </div>
            </section>
          </div>
        ) : children}
      </main>
    </div>
  );
}
