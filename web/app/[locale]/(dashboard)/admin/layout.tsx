import {redirect} from 'next/navigation';
import {unstable_noStore as noStore} from 'next/cache';
import {readAuthSession} from '@/lib/auth/server';
import {isSuperAdminUser} from '@/lib/auth/admin';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type Props = {
  children: React.ReactNode;
  params: Promise<{locale: string}>;
};

export default async function AdminLayout({children, params}: Props) {
  noStore();
  const {locale} = await params;
  const session = await readAuthSession();

  if (!session || session.role !== 'superadmin') {
    redirect(`/${locale}/login?next=/${locale}/admin/activation-queue`);
  }

  const allowed = await isSuperAdminUser(session.userId);
  if (!allowed) {
    redirect(`/${locale}/admin/login?error=admin_users_missing`);
  }

  return children;
}
