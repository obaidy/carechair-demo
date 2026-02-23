import {redirect} from 'next/navigation';
import {getTranslations} from 'next-intl/server';
import {getSessionSalon, getSalonClients} from '@/lib/data/dashboard';

type Props = {params: Promise<{locale: string}>};

export default async function ClientsPage({params}: Props) {
  const {locale} = await params;
  const t = await getTranslations();

  const salon = await getSessionSalon();
  if (!salon) redirect(`/${locale}/login?error=session`);

  const clients = await getSalonClients(salon.id);

  return (
    <div className="cc-section">
      <section className="panel hero-lite">
        <h1>{t('dashboard.clients', {defaultValue: 'Clients'})}</h1>
      </section>

      <section className="grid">
        {clients.map((client) => (
          <article className="booking-card" key={`${client.phone}-${client.name}`}>
            <div className="booking-info">
              <h3>{client.name}</h3>
              <p className="muted">{client.phone}</p>
              <p className="muted">{t('dashboard.bookings', {defaultValue: 'Bookings'})}: {client.bookings}</p>
              <p className="muted">{new Date(client.lastVisit).toLocaleString()}</p>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
