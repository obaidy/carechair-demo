import {redirect} from 'next/navigation';
import {readAuthSession} from '@/lib/auth/server';
import {SuperAdminSessionProvider} from '@/components/dashboard/SuperAdminSessionContext';

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

  return <SuperAdminSessionProvider>{children}</SuperAdminSessionProvider>;
}
