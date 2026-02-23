import Link from 'next/link';
import {getMessages} from 'next-intl/server';
import {t} from '@/lib/messages';
import {buildMetadata} from '@/lib/seo';
import {
  citySlugFromSalon,
  countrySlugFromSalon,
  getExploreData
} from '@/lib/data/public';

export async function generateMetadata() {
  const messages = await getMessages();

  return buildMetadata({
    title: t(messages, 'explore.metaTitle', 'Explore salons by city and service'),
    description: t(messages, 'explore.metaDescription', 'Find listed salons and compare service availability.'),
    pathname: '/explore'
  });
}

export default async function ExplorePage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const messages = await getMessages();
  const params = await searchParams;

  const countryFilter = String(params.country || '').trim().toLowerCase();
  const cityFilter = String(params.city || '').trim().toLowerCase();
  const query = String(params.q || '').trim().toLowerCase();

  const rows = await getExploreData();

  const filtered = rows.filter(({salon, services}) => {
    const country = countrySlugFromSalon(salon);
    const city = citySlugFromSalon(salon);

    if (countryFilter && country !== countryFilter) return false;
    if (cityFilter && city !== cityFilter) return false;

    if (!query) return true;

    const salonName = String(salon.name || '').toLowerCase();
    const serviceNames = services.map((item) => String(item.name || '').toLowerCase());
    return salonName.includes(query) || serviceNames.some((name) => name.includes(query));
  });

  return (
    <div className="container page-stack">
      <section className="section-stack">
        <h1>{t(messages, 'explore.title', 'Explore salons')}</h1>
        <p className="muted">{t(messages, 'explore.subtitle', 'Public listed salons available for booking.')}</p>
      </section>

      <section className="card-grid">
        {filtered.map(({salon, services, location}) => {
          const country = countrySlugFromSalon(salon);
          const city = citySlugFromSalon(salon);
          const href = `/${country}/${city}/${salon.slug}`;

          return (
            <article className="salon-card" key={salon.id}>
              <div className="salon-card__media" />
              <div className="salon-card__body">
                <h2>{salon.name}</h2>
                <p className="muted">{location?.formatted_address || location?.address_line || salon.area || '-'}</p>
                <p className="muted">{services.slice(0, 3).map((service) => service.name).join(' • ')}</p>
                <div className="row-actions">
                  <Link href={href} className="btn btn-primary">
                    {t(messages, 'explore.viewSalon', 'View salon')}
                  </Link>
                  <Link href={`/${country}/${city}`} className="btn btn-secondary">
                    {t(messages, 'explore.cityPage', 'City page')}
                  </Link>
                </div>
              </div>
            </article>
          );
        })}
      </section>
    </div>
  );
}
