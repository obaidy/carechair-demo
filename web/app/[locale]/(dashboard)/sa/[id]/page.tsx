import {notFound, redirect} from 'next/navigation';
import {getTranslations} from 'next-intl/server';
import {Link} from '@/i18n/navigation';
import {readAuthSession} from '@/lib/auth/server';
import {superadminSalonAction} from '@/lib/actions/dashboard';
import {getSuperadminSalonDetail} from '@/lib/data/dashboard';

type Props = {params: Promise<{locale: string; id: string}>};

export default async function SuperadminSalonDetailPage({params}: Props) {
  const {locale, id} = await params;
  const t = await getTranslations();

  const session = await readAuthSession();
  if (!session || session.role !== 'superadmin') {
    redirect(`/${locale}/login?error=superadmin`);
  }

  const detail = await getSuperadminSalonDetail(id);
  if (!detail) notFound();

  const {salon, overview, bookings} = detail;
  const isPublic = Boolean(salon.is_public ?? salon.is_listed ?? false);

  return (
    <div className="container page-stack">
      <section className="hero-card">
        <p className="eyebrow">/{salon.slug}</p>
        <h1 className="hero-title-clamp">{salon.name}</h1>
        <p>{salon.area || '-'}</p>
      </section>

      <section className="kpi-grid">
        <article className="kpi-card"><span>Bookings 30d</span><strong>{overview.bookings30d}</strong></article>
        <article className="kpi-card"><span>Clients 30d</span><strong>{overview.clients30d}</strong></article>
        <article className="kpi-card"><span>Revenue 30d</span><strong>{overview.revenue30d.toFixed(0)}</strong></article>
        <article className="kpi-card"><span>Status</span><strong>{String(salon.status || salon.subscription_status || 'draft')}</strong></article>
      </section>

      <section className="salon-info-card">
        <h2>{t('superadmin.actions', {defaultValue: 'Actions'})}</h2>
        <div className="row-actions">
          <form action={superadminSalonAction}>
            <input type="hidden" name="salonId" value={salon.id} />
            <input type="hidden" name="action" value="approve_trial" />
            <input type="hidden" name="path" value={`/${locale}/sa/${salon.id}`} />
            <button className="btn btn-secondary" type="submit">Approve trial</button>
          </form>

          <form action={superadminSalonAction}>
            <input type="hidden" name="salonId" value={salon.id} />
            <input type="hidden" name="action" value="suspend" />
            <input type="hidden" name="path" value={`/${locale}/sa/${salon.id}`} />
            <button className="btn btn-secondary" type="submit">Suspend</button>
          </form>

          <form action={superadminSalonAction}>
            <input type="hidden" name="salonId" value={salon.id} />
            <input type="hidden" name="action" value="resume" />
            <input type="hidden" name="path" value={`/${locale}/sa/${salon.id}`} />
            <button className="btn btn-secondary" type="submit">Resume</button>
          </form>

          <form action={superadminSalonAction}>
            <input type="hidden" name="salonId" value={salon.id} />
            <input type="hidden" name="action" value="toggle_visibility" />
            <input type="hidden" name="isPublic" value={isPublic ? 'false' : 'true'} />
            <input type="hidden" name="path" value={`/${locale}/sa/${salon.id}`} />
            <button className="btn btn-secondary" type="submit">{isPublic ? 'Hide' : 'Show'} explore</button>
          </form>

          <Link href="/sa" className="btn btn-primary">Back to salons</Link>
        </div>
      </section>

      <section className="salon-info-card">
        <h2>{t('superadmin.recentBookings', {defaultValue: 'Recent bookings'})}</h2>
        <div className="dashboard-list">
          {bookings.slice(0, 30).map((booking) => (
            <article key={booking.id} className="dashboard-item-card">
              <div className="dashboard-item-main">
                <h3>{booking.customer_name}</h3>
                <p className="muted">{booking.customer_phone}</p>
                <p className="muted">{new Date(booking.appointment_start).toLocaleString()}</p>
                <p className="muted">{booking.status}</p>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
