'use client';

import SalonCalendar from '@/components/calendar/SalonCalendar';

export default function CalendarPage({salon, writeLocked, onChanged}: {salon: {id: string}; writeLocked: boolean; onChanged?: () => Promise<void> | void}) {
  return <SalonCalendar salon={salon} writeLocked={writeLocked} onChanged={onChanged} />;
}
