import {redirect} from 'next/navigation';
import {getTranslations} from 'next-intl/server';
import {getSessionSalon, getSalonBookings, getSalonServices, getSalonStaff} from '@/lib/data/dashboard';
import {updateBookingStatusAction} from '@/lib/actions/dashboard';

type Props = {params: Promise<{locale: string}>};

export default async function BookingsPage({params}: Props) {
  const {locale} = await params;
  const t = await getTranslations();

  const salon = await getSessionSalon();
  if (!salon) redirect(`/${locale}/login?error=session`);

  const [bookings, services, staff] = await Promise.all([
    getSalonBookings(salon.id, 300),
    getSalonServices(salon.id),
    getSalonStaff(salon.id)
  ]);

  const serviceById = Object.fromEntries(services.map((row) => [row.id, row]));
  const staffById = Object.fromEntries(staff.map((row) => [row.id, row]));

  return (
    <div className="cc-section">
      <section className="panel hero-lite">
        <h1>{t('dashboard.bookings', {defaultValue: 'Bookings'})}</h1>
        <p className="muted">{t('dashboard.bookingsHint', {defaultValue: 'Recent appointments and status updates.'})}</p>
      </section>

      <section className="grid">
        {bookings.map((booking) => (
          <article key={booking.id} className="booking-card">
            <div className="booking-info">
              <h3>{booking.customer_name || 'Customer'}</h3>
              <p className="muted">{new Date(booking.appointment_start).toLocaleString()}</p>
              <p className="muted">{serviceById[booking.service_id || '']?.name || '-'}</p>
              <p className="muted">{staffById[booking.staff_id || '']?.name || '-'}</p>
            </div>

            <form action={updateBookingStatusAction} className="row-actions">
              <input type="hidden" name="bookingId" value={booking.id} />
              <input type="hidden" name="path" value={`/${locale}/app/bookings`} />
              <input type="hidden" name="status" value={booking.status === 'confirmed' ? 'cancelled' : 'confirmed'} />
              <button type="submit" className="btn btn-secondary">
                {booking.status === 'confirmed'
                  ? t('dashboard.markCancelled', {defaultValue: 'Mark cancelled'})
                  : t('dashboard.markConfirmed', {defaultValue: 'Mark confirmed'})}
              </button>
            </form>
          </article>
        ))}
      </section>
    </div>
  );
}
