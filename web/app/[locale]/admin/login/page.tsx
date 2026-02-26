import {redirect} from 'next/navigation';

type Props = {
  params: Promise<{locale: string}>;
  searchParams: Promise<{error?: string}>;
};

export default async function AdminLoginRedirect({params, searchParams}: Props) {
  const {locale} = await params;
  const query = await searchParams;
  const error = String(query?.error || '');
  const next = `/${locale}/admin/activation-queue`;
  redirect(`/${locale}/login?next=${next}${error ? `&error=${encodeURIComponent(error)}` : ''}`);
}
