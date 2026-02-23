import {redirect} from 'next/navigation';
import {getTranslations} from 'next-intl/server';
import {getSessionSalon, getSalonBookings, getSalonServices, getSalonStaff} from '@/lib/data/dashboard';

type Props = {params: Promise<{locale: string}>};

function toDateKey(iso: string): string {
  return String(iso || '').slice(0, 10);
}

export default async function CalendarPage({params}: Props) {
  const {locale} = await params;
  const t = await getTranslations();

  const salon = await getSessionSalon();
  if (!salon) redirect(`/${locale}/login?error=session`);

  const [bookings, services, staff] = await Promise.all([
    getSalonBookings(salon.id, 500),
    getSalonServices(salon.id),
    getSalonStaff(salon.id)
  ]);

  const serviceById = Object.fromEntries(services.map((row) => [row.id, row]));
  const staffById = Object.fromEntries(staff.map((row) => [row.id, row]));

  const grouped = new Map<string, typeof bookings>();
  for (const booking of bookings) {
    const key = toDateKey(booking.appointment_start);
    const list = grouped.get(key) || [];
    list.push(booking);
    grouped.set(key, list);
  }

  const rows = Array.from(grouped.entries()).sort((a, b) => a[0].localeCompare(b[0]));

  return (
    <div className="cc-section">
      <section className="panel hero-lite">
        <h1>{t('dashboard.calendar', {defaultValue: 'Calendar'})}</h1>
        <p className="muted">{t('dashboard.calendarHint', {defaultValue: 'Daily booking timeline grouped by date.'})}</p>
      </section>

      <section className="calendar-list">
        {rows.map(([dateKey, items]) => (
          <section key={dateKey} className="date-group">
            <div className="date-header">
              <h5>{dateKey}</h5>
              <span>{items.length}</span>
            </div>
            <div className="bookings-stack">
              {items.map((booking) => (
                <article key={booking.id} className="booking-card">
                  <div className="booking-top">
                    <div>
                      <h6>{booking.customer_name}</h6>
                      <p>{new Date(booking.appointment_start).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})}</p>
                    </div>
                    <span className={`status-badge status-${String(booking.status || 'pending')}`}>
                      {String(booking.status || 'pending')}
                    </span>
                  </div>
                  <div className="booking-info">
                    <p>{serviceById[booking.service_id || '']?.name || '-'}</p>
                    <p>{staffById[booking.staff_id || '']?.name || '-'}</p>
                  </div>
                </article>
              ))}
            </div>
          </section>
        ))}
      </section>
    </div>
  );
}
