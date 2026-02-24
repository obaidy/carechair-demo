import {redirect} from 'next/navigation';
import {Link} from '@/i18n/navigation';
import {getSessionSalon, getSalonOverview} from '@/lib/data/dashboard';
import {getMessages, tx} from '@/lib/messages';
import type {Locale} from '@/lib/i18n';

type Props = {params: Promise<{locale: string}>};

export default async function SalonDashboardPage({params}: Props) {
  const {locale} = await params;
  const messages = await getMessages(locale as Locale);

  const salon = await getSessionSalon();
  if (!salon) {
    redirect(`/${locale}/login?error=session`);
  }

  const overview = await getSalonOverview(salon.id);

  return (
    <div className="cc-section">
      <section className="panel hero-lite">
        <h2>{salon.name}</h2>
        <p>{salon.area || '-'}</p>
      </section>

      <section className="kpi-grid">
        <article className="kpi-card"><span>{tx(messages, 'dashboard.bookingsToday', 'Bookings today')}</span><strong>{overview.bookingsToday}</strong></article>
        <article className="kpi-card"><span>{tx(messages, 'dashboard.bookings30d', 'Bookings 30d')}</span><strong>{overview.bookings30d}</strong></article>
        <article className="kpi-card"><span>{tx(messages, 'dashboard.confirmed30d', 'Confirmed 30d')}</span><strong>{overview.confirmed30d}</strong></article>
        <article className="kpi-card"><span>{tx(messages, 'dashboard.pending', 'Pending')}</span><strong>{overview.pendingCount}</strong></article>
        <article className="kpi-card"><span>{tx(messages, 'dashboard.clients30d', 'Clients 30d')}</span><strong>{overview.clients30d}</strong></article>
        <article className="kpi-card"><span>{tx(messages, 'dashboard.revenue30d', 'Revenue 30d')}</span><strong>{overview.revenue30d.toFixed(0)}</strong></article>
      </section>

      <section className="panel">
        <h2>{tx(messages, 'dashboard.quickActions', 'Quick actions')}</h2>
        <div className="row-actions">
          <Link href="/app/bookings" className="btn btn-primary">{tx(messages, 'dashboard.bookings', 'Bookings')}</Link>
          <Link href="/app/calendar" className="btn btn-secondary">{tx(messages, 'dashboard.calendar', 'Calendar')}</Link>
          <Link href="/app/staff" className="btn btn-secondary">{tx(messages, 'dashboard.staff', 'Staff')}</Link>
          <Link href="/app/services" className="btn btn-secondary">{tx(messages, 'dashboard.services', 'Services')}</Link>
          <Link href="/app/settings" className="btn btn-secondary">{tx(messages, 'dashboard.settings', 'Settings')}</Link>
        </div>
      </section>
    </div>
  );
}
