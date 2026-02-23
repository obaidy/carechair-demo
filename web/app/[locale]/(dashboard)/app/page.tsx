import {redirect} from 'next/navigation';
import {getTranslations} from 'next-intl/server';
import {Link} from '@/i18n/navigation';
import {getSessionSalon, getSalonOverview} from '@/lib/data/dashboard';

type Props = {params: Promise<{locale: string}>};

export default async function SalonDashboardPage({params}: Props) {
  const {locale} = await params;
  const t = await getTranslations();

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
        <article className="kpi-card"><span>{t('dashboard.bookingsToday', {defaultValue: 'Bookings today'})}</span><strong>{overview.bookingsToday}</strong></article>
        <article className="kpi-card"><span>{t('dashboard.bookings30d', {defaultValue: 'Bookings 30d'})}</span><strong>{overview.bookings30d}</strong></article>
        <article className="kpi-card"><span>{t('dashboard.confirmed30d', {defaultValue: 'Confirmed 30d'})}</span><strong>{overview.confirmed30d}</strong></article>
        <article className="kpi-card"><span>{t('dashboard.pending', {defaultValue: 'Pending'})}</span><strong>{overview.pendingCount}</strong></article>
        <article className="kpi-card"><span>{t('dashboard.clients30d', {defaultValue: 'Clients 30d'})}</span><strong>{overview.clients30d}</strong></article>
        <article className="kpi-card"><span>{t('dashboard.revenue30d', {defaultValue: 'Revenue 30d'})}</span><strong>{overview.revenue30d.toFixed(0)}</strong></article>
      </section>

      <section className="panel">
        <h2>{t('dashboard.quickActions', {defaultValue: 'Quick actions'})}</h2>
        <div className="row-actions">
          <Link href="/app/bookings" className="btn btn-primary">{t('dashboard.bookings', {defaultValue: 'Bookings'})}</Link>
          <Link href="/app/calendar" className="btn btn-secondary">{t('dashboard.calendar', {defaultValue: 'Calendar'})}</Link>
          <Link href="/app/staff" className="btn btn-secondary">{t('dashboard.staff', {defaultValue: 'Staff'})}</Link>
          <Link href="/app/services" className="btn btn-secondary">{t('dashboard.services', {defaultValue: 'Services'})}</Link>
          <Link href="/app/settings" className="btn btn-secondary">{t('dashboard.settings', {defaultValue: 'Settings'})}</Link>
        </div>
      </section>
    </div>
  );
}
