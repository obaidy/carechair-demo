import {redirect} from 'next/navigation';
import {getSessionSalon, getSalonClients} from '@/lib/data/dashboard';
import {getMessages, tx} from '@/lib/messages';
import type {Locale} from '@/lib/i18n';

type Props = {params: Promise<{locale: string}>};

export default async function ClientsPage({params}: Props) {
  const {locale} = await params;
  const messages = await getMessages(locale as Locale);

  const salon = await getSessionSalon();
  if (!salon) redirect(`/${locale}/login?error=session`);

  const clients = await getSalonClients(salon.id);

  return (
    <div className="cc-section">
      <section className="panel hero-lite">
        <h1>{tx(messages, 'dashboard.clients', 'Clients')}</h1>
      </section>

      <section className="bookings-stack">
        {clients.map((client) => (
          <article className="booking-card" key={`${client.phone}-${client.name}`}>
            <div className="booking-top">
              <div>
                <h6>{client.name}</h6>
                <p>{client.phone}</p>
              </div>
              <span className="status-badge status-confirmed">{client.bookings}</span>
            </div>
            <div className="booking-info">
              <p className="muted">{tx(messages, 'dashboard.bookings', 'Bookings')}: {client.bookings}</p>
              <p className="muted">{new Date(client.lastVisit).toLocaleString()}</p>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
