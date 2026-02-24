import {redirect} from 'next/navigation';

type Props = {
  params: Promise<{locale: string}>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ApplyPage({params, searchParams}: Props) {
  const {locale} = await params;
  const qp = await searchParams;
  const invite = Array.isArray(qp.invite) ? qp.invite[0] : qp.invite;
  const safeInvite = String(invite || '').trim();
  const query = safeInvite ? `?invite=${encodeURIComponent(safeInvite)}` : '';
  redirect(`/${locale}/onboarding/salon-setup${query}`);
}
