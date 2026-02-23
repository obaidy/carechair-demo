import {getTranslations} from 'next-intl/server';
import DashboardNav from '@/components/DashboardNav';

type Props = {
  children: React.ReactNode;
  params: Promise<{locale: string}>;
};

export default async function SuperadminLayout({children, params}: Props) {
  const {locale} = await params;
  const t = await getTranslations();

  const items = [
    {href: `/${locale}/sa`, label: t('superadmin.overview', {defaultValue: 'Overview'})}
  ];

  return (
    <div className="platform-page">
      <DashboardNav
        title={t('nav.superadmin', {defaultValue: 'Superadmin'})}
        items={items}
        logoutHref={`/api/auth/logout?next=/${locale}/login`}
      />
      <main className="platform-main">{children}</main>
    </div>
  );
}
