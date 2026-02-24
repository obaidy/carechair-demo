import {notFound, redirect} from 'next/navigation';
import {citySlugFromSalon, countrySlugFromSalon, getPublicSalonBySlugSafe} from '@/lib/data/public';
import {normalizeSlug} from '@/lib/slug';

type Props = {
  params: Promise<{locale: string; slug: string}>;
};

export default async function LegacySalonBookingRoute({params}: Props) {
  const {locale, slug} = await params;
  const {data: salon} = await getPublicSalonBySlugSafe(slug);

  if (!salon) {
    notFound();
  }

  redirect(`/${locale}/${countrySlugFromSalon(salon)}/${citySlugFromSalon(salon)}/${normalizeSlug(salon.slug)}`);
}
