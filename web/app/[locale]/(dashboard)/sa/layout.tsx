import {redirect} from 'next/navigation';
import {readAuthSession} from '@/lib/auth/server';
import {SuperAdminSessionProvider} from '@/components/dashboard/SuperAdminSessionContext';
import {isSuperAdminUser} from '@/lib/auth/admin';

type Props = {
  children: React.ReactNode;
  params: Promise<{locale: string}>;
};

export default async function SuperadminLayout({children, params}: Props) {
  const {locale} = await params;
  const session = await readAuthSession();
  if (!session || session.role !== 'superadmin') {
    redirect(`/${locale}/login?next=/${locale}/sa`);
  }

  const allowed = await isSuperAdminUser(session.userId);
  if (!allowed) {
    redirect(`/${locale}/login?next=/${locale}/sa&error=admin_users_missing`);
  }

  return <SuperAdminSessionProvider>{children}</SuperAdminSessionProvider>;
}
