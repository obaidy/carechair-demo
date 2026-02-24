import {notFound} from 'next/navigation';
import {getMessages} from 'next-intl/server';
import {tx} from '@/lib/messages';
import {buildMetadata} from '@/lib/seo';
import {citySlugFromSalon, countrySlugFromSalon, getCityListingDataSafe} from '@/lib/data/public';
import {Link} from '@/i18n/navigation';
import {normalizeSlug} from '@/lib/slug';
import SafeImage from '@/components/SafeImage';
import {Badge, Button, Card} from '@/components/ui';
import {formatSalonOperationalCurrency} from '@/lib/format';
import {getInitials, getSalonMedia} from '@/lib/media';
import {isValidE164WithoutPlus, normalizeIraqiPhone} from '@/lib/phone';
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
  const socialProofText =
    rows.length <= 5
      ? tx(messages, 'explore.socialProofEarly', 'Centers that started using CareChair ({{count}})', {count: rows.length})
      : tx(messages, 'explore.socialProof', 'Centers using CareChair to organize bookings ({{count}})', {count: rows.length});

  return (
    <PageShell title={cityName} subtitle={tx(messages, 'city.subtitle', 'Listed salons and services in this city.')}>
      <Card className="explore-social-proof">
        <b>{socialProofText}</b>
      </Card>

      <section className="explore-grid">
        {rows.map(({salon, services}) => {
          const countryPath = countrySlugFromSalon(salon);
          const cityPath = citySlugFromSalon(salon);
          const media = getSalonMedia(salon);
          const minPrice = services.reduce((min, row) => (Number(row.price) < min ? Number(row.price) : min), Number.POSITIVE_INFINITY);
          const phone = normalizeIraqiPhone(salon.whatsapp || '');
          const hasWhats = isValidE164WithoutPlus(phone);
          const isActive = Boolean(salon.is_active);

          return (
            <article className="explore-card" key={salon.id}>
              <div className="explore-cover-wrap">
                <SafeImage src={media.cover} alt={salon.name} className="explore-cover" fallbackIcon="✨" fallbackKey="cover" />
                <Badge variant="featured" className="floating-featured">
                  {tx(messages, 'explore.featured', 'Featured')}
                </Badge>
              </div>

              <Card className="explore-card-body">
                <div className="explore-head">
                  <div className="explore-head-main">
                    <SafeImage src={salon.logo_url || ''} alt={salon.name} className="explore-logo" fallbackText={getInitials(salon.name)} fallbackKey="logo" />
                    <h3>{salon.name}</h3>
                  </div>
                  <span className="area-badge">{salon.area || tx(messages, 'explore.defaultArea', 'City')}</span>
                </div>

                <div className="salon-trust-badges">
                  <Badge variant="neutral">{tx(messages, 'explore.badges.fastConfirm', 'Fast confirmation')}</Badge>
                  <Badge variant="neutral">{tx(messages, 'explore.badges.easyBooking', 'Easy booking')}</Badge>
                  {hasWhats ? <Badge variant="featured">{tx(messages, 'explore.badges.whatsappAvailable', 'WhatsApp available')}</Badge> : null}
                  {!isActive ? <Badge variant="pending">{tx(messages, 'explore.badges.pendingActivation', 'Pending activation')}</Badge> : null}
                </div>

                {Number.isFinite(minPrice) ? (
                  <p className="starting-price">
                    {tx(messages, 'explore.startingFrom', 'Starting from')} {formatSalonOperationalCurrency(minPrice, salon, locale)}
                  </p>
                ) : null}

                <div className="mini-services">
                  {services.length === 0 ? (
                    <p className="muted">{tx(messages, 'explore.noServices', 'No active services yet.')}</p>
                  ) : (
                    services.slice(0, 3).map((service) => (
                      <span className="service-tag" key={service.id}>
                        {service.name} • {formatSalonOperationalCurrency(service.price, salon, locale)}
                      </span>
                    ))
                  )}
                </div>

                <div className="row-actions">
                  <Button as={Link as any} href={`/s/${encodeURIComponent(normalizeSlug(salon.slug))}`}>
                    {tx(messages, 'explore.bookNow', 'Book now')}
                  </Button>
                  {hasWhats ? (
                    <Button as="a" variant="secondary" href={`https://wa.me/${phone}`} target="_blank" rel="noreferrer">
                      {tx(messages, 'common.whatsapp', 'WhatsApp')}
                    </Button>
                  ) : services[0] ? (
                    <Button as={Link as any} variant="secondary" href={`/${countryPath}/${cityPath}/${normalizeSlug(services[0].name)}`}>
                      {tx(messages, 'city.viewService', 'View service salons')}
                    </Button>
                  ) : null}
                </div>
              </Card>
            </article>
          );
        })}
      </section>
    </PageShell>
  );
}
