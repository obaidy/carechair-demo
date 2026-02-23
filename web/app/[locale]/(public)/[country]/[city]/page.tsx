import {notFound} from 'next/navigation';
import {getMessages} from 'next-intl/server';
import {tx} from '@/lib/messages';
import {buildMetadata} from '@/lib/seo';
import {getCityListingDataSafe, countrySlugFromSalon, citySlugFromSalon} from '@/lib/data/public';
import {Link} from '@/i18n/navigation';
import {normalizeSlug} from '@/lib/slug';
import {Card} from '@/components/ui';
import PageShell from '@/components/PageShell';

type PageProps = {
  params: Promise<{locale: string; country: string; city: string}>;
};

export async function generateMetadata({params}: PageProps) {
  const {locale, country, city} = await params;
  const messages = await getMessages({locale});

  const countryLabel = normalizeSlug(country).toUpperCase();
  const cityLabel = decodeURIComponent(city).replace(/-/g, ' ');

  return buildMetadata({
    title: tx(messages, 'city.metaTitle', `${cityLabel} salons | CareChair`),
    description: tx(messages, 'city.metaDescription', `Browse listed salons in ${cityLabel}, ${countryLabel}.`),
    pathname: `/${country}/${city}`
  });
}

export default async function CityPage({params}: PageProps) {
  const {locale, country, city} = await params;
  const messages = await getMessages({locale});

  const {data: rows, error} = await getCityListingDataSafe(country, city);
  if (error) {
    return (
      <PageShell title={decodeURIComponent(city).replace(/-/g, ' ')} subtitle={tx(messages, 'city.subtitle', 'Listed salons and services in this city.')}>
        <Card>
          <p className="muted">{tx(messages, 'city.loadError', 'Could not load this city right now.')}</p>
          <p className="muted">{error}</p>
        </Card>
      </PageShell>
    );
  }
  if (!rows.length) notFound();

  const cityName = decodeURIComponent(city).replace(/-/g, ' ');

  return (
    <PageShell title={cityName} subtitle={tx(messages, 'city.subtitle', 'Listed salons and services in this city.')}>
      <section className="cc-section">
        <h1>{cityName}</h1>
      </section>

      <section className="explore-grid">
        {rows.map(({salon, services}) => {
          const countryPath = countrySlugFromSalon(salon);
          const cityPath = citySlugFromSalon(salon);

          return (
            <Card className="explore-card-body" key={salon.id}>
              <div>
                <h2>{salon.name}</h2>
                <p className="muted">{salon.area || '-'}</p>
                <p className="muted">{services.slice(0, 4).map((service) => service.name).join(' • ')}</p>
                <div className="row-actions">
                  <Link href={`/${countryPath}/${cityPath}/${normalizeSlug(salon.slug)}`} className="btn btn-primary">
                    {tx(messages, 'city.viewSalon', 'View salon')}
                  </Link>
                  {services[0] ? (
                    <Link href={`/${countryPath}/${cityPath}/${normalizeSlug(services[0].name)}`} className="btn btn-secondary">
                      {tx(messages, 'city.viewService', 'View service salons')}
                    </Link>
                  ) : null}
                </div>
              </div>
            </Card>
          );
        })}
      </section>
    </PageShell>
  );
}
