import {SalonAdminSessionProvider} from '@/components/dashboard/SalonAdminSessionContext';

export default function SalonAdminLayout({children}: {children: React.ReactNode}) {
  return <SalonAdminSessionProvider>{children}</SalonAdminSessionProvider>;
}
