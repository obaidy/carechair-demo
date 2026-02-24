import {redirect} from 'next/navigation';
import SalonCalendar from '@/components/calendar/SalonCalendar';
import {getSessionSalon} from '@/lib/data/dashboard';
import {getMessages, tx} from '@/lib/messages';
import type {Locale} from '@/lib/i18n';

type Props = {
  params: Promise<{locale: string}>;
};

export default async function CalendarPage({params}: Props) {
  const {locale} = await params;
  const messages = await getMessages(locale as Locale);

  const salon = await getSessionSalon();
  if (!salon) redirect(`/${locale}/login?error=session`);

  return (
    <div className="cc-section">
      <section className="panel hero-lite">
        <h1>{tx(messages, 'dashboard.calendar', 'Calendar')}</h1>
        <p className="muted">{tx(messages, 'dashboard.calendarHint', 'Daily booking timeline grouped by date.')}</p>
      </section>

      <SalonCalendar
        salon={{id: salon.id}}
        writeLocked={false}
      />
    </div>
  );
}
