import {redirect} from 'next/navigation';
import SalonBookingsClient from '@/components/dashboard/SalonBookingsClient';
import {getSessionSalon, getSalonBookings, getSalonServices, getSalonStaff} from '@/lib/data/dashboard';

type Props = {
  params: Promise<{locale: string}>;
};

export default async function BookingsPage({params}: Props) {
  const {locale} = await params;

  const salon = await getSessionSalon();
  if (!salon) redirect(`/${locale}/login?error=session`);

  const [bookings, services, staff] = await Promise.all([
    getSalonBookings(salon.id, 2000),
    getSalonServices(salon.id),
    getSalonStaff(salon.id)
  ]);

  return (
    <SalonBookingsClient
      salonId={salon.id}
      initialBookings={bookings}
      services={services}
      staff={staff}
    />
  );
}
