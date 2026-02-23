import Link from 'next/link';
import {notFound} from 'next/navigation';
import {getMessages} from 'next-intl/server';
import {t} from '@/lib/messages';
import {buildMetadata} from '@/lib/seo';
import {getCityListingData, countrySlugFromSalon, citySlugFromSalon} from '@/lib/data/public';
import {normalizeSlug} from '@/lib/slug';

type PageProps = {
  params: Promise<{country: string; city: string}>;
};

export async function generateMetadata({params}: PageProps) {
  const {country, city} = await params;
  const messages = await getMessages();

  const countryLabel = normalizeSlug(country).toUpperCase();
  const cityLabel = decodeURIComponent(city).replace(/-/g, ' ');

  return buildMetadata({
    title: t(messages, 'city.metaTitle', `${cityLabel} salons | CareChair`),
    description: t(messages, 'city.metaDescription', `Browse listed salons in ${cityLabel}, ${countryLabel}.`),
    pathname: `/${country}/${city}`
  });
}

export default async function CityPage({params}: PageProps) {
  const {country, city} = await params;
  const messages = await getMessages();

  const rows = await getCityListingData(country, city);

  if (!rows.length) {
    notFound();
  }

  const cityName = decodeURIComponent(city).replace(/-/g, ' ');

  return (
    <div className="container page-stack">
      <section className="section-stack">
        <h1>
          {cityName}
        </h1>
        <p className="muted">{t(messages, 'city.subtitle', 'Listed salons and services in this city.')}</p>
      </section>

      <section className="card-grid">
        {rows.map(({salon, services}) => {
          const countryPath = countrySlugFromSalon(salon);
          const cityPath = citySlugFromSalon(salon);

          return (
            <article className="salon-card" key={salon.id}>
              <div className="salon-card__body">
                <h2>{salon.name}</h2>
                <p className="muted">{salon.area || '-'}</p>
                <p className="muted">{services.slice(0, 4).map((service) => service.name).join(' • ')}</p>
                <div className="row-actions">
                  <Link
                    href={`/${countryPath}/${cityPath}/${salon.slug}`}
                    className="btn btn-primary"
                  >
                    {t(messages, 'city.viewSalon', 'View salon')}
                  </Link>
                  {services[0] ? (
                    <Link
                      href={`/${countryPath}/${cityPath}/${normalizeSlug(services[0].name)}`}
                      className="btn btn-secondary"
                    >
                      {t(messages, 'city.viewService', 'View service salons')}
                    </Link>
                  ) : null}
                </div>
              </div>
            </article>
          );
        })}
      </section>
    </div>
  );
}
