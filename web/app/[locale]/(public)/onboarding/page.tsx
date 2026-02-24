import {redirect} from 'next/navigation';

type Props = {
  params: Promise<{locale: string}>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function OnboardingIndexPage({params, searchParams}: Props) {
  const {locale} = await params;
  const qp = await searchParams;
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(qp)) {
    if (Array.isArray(value)) {
      for (const item of value) query.append(key, String(item));
    } else if (value != null) {
      query.set(key, String(value));
    }
  }
  const suffix = query.toString();
  redirect(`/${locale}/onboarding/salon-setup${suffix ? `?${suffix}` : ''}`);
}
