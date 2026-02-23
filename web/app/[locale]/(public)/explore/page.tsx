import {getMessages} from 'next-intl/server';
import {tx} from '@/lib/messages';
import {buildMetadata} from '@/lib/seo';
import {Link} from '@/i18n/navigation';
import {citySlugFromSalon, countrySlugFromSalon, getExploreData} from '@/lib/data/public';
import SafeImage from '@/components/SafeImage';
import {Badge, Button, Card} from '@/components/ui';
import {formatSalonOperationalCurrency} from '@/lib/format';
import {getInitials, getSalonMedia} from '@/lib/media';
import {isValidE164WithoutPlus, normalizeIraqiPhone} from '@/lib/phone';

type Props = {
  params: Promise<{locale: string}>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({params}: {params: Promise<{locale: string}>}) {
  const {locale} = await params;
  const messages = await getMessages({locale});

  return buildMetadata({
    title: tx(messages, 'explore.metaTitle', 'Explore salons by city and service'),
    description: tx(messages, 'explore.metaDescription', 'Find listed salons and compare service availability.'),
    pathname: '/explore'
  });
}

export default async function ExplorePage({params, searchParams}: Props) {
  const {locale} = await params;
  const queryParams = await searchParams;
  const messages = await getMessages({locale});

  const countryFilter = String(queryParams.country || '').trim().toLowerCase();
  const cityFilter = String(queryParams.city || '').trim().toLowerCase();
  const query = String(queryParams.q || '').trim().toLowerCase();

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

  const socialProofText =
    filtered.length <= 5
      ? tx(messages, 'explore.socialProofEarly', 'Centers that started using CareChair ({{count}})', {count: filtered.length})
      : tx(messages, 'explore.socialProof', 'Centers using CareChair to organize bookings ({{count}})', {count: filtered.length});

  return (
    <div className="cc-container cc-section">
      <Card className="explore-social-proof">
        <b>{socialProofText}</b>
      </Card>

      <Card className="explore-hero">
        <div>
          <Badge variant="featured">{tx(messages, 'explore.platformBadge', 'CareChair Platform')}</Badge>
          <h2>{tx(messages, 'explore.heroTitle', 'Discover the best salons')}</h2>
          <p>{tx(messages, 'explore.heroText', 'Choose your service, compare centers, and book instantly.')}</p>
        </div>
      </Card>

      {filtered.length === 0 ? (
        <Card>
          <p className="muted">{tx(messages, 'explore.empty', 'No salons match the current filters.')}</p>
        </Card>
      ) : (
        <section className="explore-grid">
          {filtered.map(({salon, services}) => {
            const country = countrySlugFromSalon(salon);
            const city = citySlugFromSalon(salon);
            const href = `/${country}/${city}/${salon.slug}`;
            const cityHref = `/${country}/${city}`;
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
                      services.slice(0, 3).map((srv) => (
                        <span className="service-tag" key={srv.id}>
                          {srv.name} • {formatSalonOperationalCurrency(srv.price, salon, locale)}
                        </span>
                      ))
                    )}
                  </div>

                  <div className="row-actions">
                    <Button as={Link as any} href={href}>
                      {tx(messages, 'explore.bookNow', 'Book now')}
                    </Button>
                    {hasWhats ? (
                      <Button as="a" variant="secondary" href={`https://wa.me/${phone}`} target="_blank" rel="noreferrer">
                        {tx(messages, 'common.whatsapp', 'WhatsApp')}
                      </Button>
                    ) : (
                      <Button as={Link as any} variant="secondary" href={cityHref}>
                        {tx(messages, 'explore.cityPage', 'City page')}
                      </Button>
                    )}
                  </div>
                </Card>
              </article>
            );
          })}
        </section>
      )}
    </div>
  );
}
