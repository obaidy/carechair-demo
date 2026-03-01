import {SalonAdminSessionProvider} from '@/components/dashboard/SalonAdminSessionContext';
import {readAuthSession} from '@/lib/auth/server';

type Props = {
  children: React.ReactNode;
  params: Promise<{slug: string}>;
};

export default async function SalonAdminLayout({children, params}: Props) {
  const {slug} = await params;
  const session = await readAuthSession();
  const initialUnlocked =
    session?.role === 'salon_admin' &&
    String(session.salonSlug || '').trim().toLowerCase() === decodeURIComponent(String(slug || '')).trim().toLowerCase();

  return <SalonAdminSessionProvider initialUnlocked={initialUnlocked}>{children}</SalonAdminSessionProvider>;
}
