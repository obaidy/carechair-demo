import {redirect} from 'next/navigation';
import {detectLocale} from '@/lib/i18n-server';

export default async function ExploreRedirectPage() {
  const locale = await detectLocale();
  redirect(`/${locale}/explore`);
}
