import {getMessages} from 'next-intl/server';
import {tx} from '@/lib/messages';
import {buildMetadata} from '@/lib/seo';
import {Link} from '@/i18n/navigation';
import {citySlugFromSalon, countrySlugFromSalon, getExploreDataSafe} from '@/lib/data/public';
import SafeImage from '@/components/SafeImage';
import {Badge, Button, Card} from '@/components/ui';
import {formatSalonOperationalCurrency} from '@/lib/format';
import {getInitials, getSalonMedia} from '@/lib/media';
import {isValidE164WithoutPlus, normalizeIraqiPhone} from '@/lib/phone';
import PageShell from '@/components/PageShell';
import {normalizeSlug} from '@/lib/slug';

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
  const areaFilter = String(queryParams.area || '').trim();
  const categoryFilter = String(queryParams.category || 'all').trim().toLowerCase();
  const sortBy = String(queryParams.sort || 'newest').trim().toLowerCase();

  const {data: rows, error} = await getExploreDataSafe();
  const categories = [
    {key: 'all', label: tx(messages, 'explore.categories.all', 'All'), keywords: []},
    {key: 'haircut', label: tx(messages, 'explore.categories.haircut', 'Haircut'), keywords: ['قص', 'شعر', 'hair', 'cut']},
    {key: 'color', label: tx(messages, 'explore.categories.color', 'Color'), keywords: ['صبغ', 'لون', 'color']},
    {key: 'nails', label: tx(messages, 'explore.categories.nails', 'Nails'), keywords: ['اظافر', 'أظافر', 'مانيكير', 'باديكير', 'nail']},
    {key: 'facial', label: tx(messages, 'explore.categories.facial', 'Facial'), keywords: ['بشرة', 'تنظيف', 'facial', 'skin']},
    {key: 'makeup', label: tx(messages, 'explore.categories.makeup', 'Makeup'), keywords: ['مكياج', 'ميكاب', 'makeup']}
  ];
  const activeCategory = categories.find((item) => item.key === categoryFilter) || categories[0];
  const areaOptions = Array.from(new Set(rows.map((row) => row.salon.area).filter(Boolean))).map((item) => String(item));

  const filtered = rows.filter(({salon, services}) => {
    const country = countrySlugFromSalon(salon);
    const city = citySlugFromSalon(salon);

    if (countryFilter && country !== countryFilter) return false;
    if (cityFilter && city !== cityFilter) return false;

    if (!query) return true;
    if (areaFilter && String(salon.area || '') !== areaFilter) return false;

    const salonName = String(salon.name || '').toLowerCase();
    const serviceNames = services.map((item) => String(item.name || '').toLowerCase());
    const queryMatch = !query || salonName.includes(query) || serviceNames.some((name) => name.includes(query));
    if (!queryMatch) return false;

    if (activeCategory.key === 'all') return true;
    return serviceNames.some((name) => activeCategory.keywords.some((keyword) => name.includes(keyword)));
  });
  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === 'nearest') {
      return String(a.salon.name || '').localeCompare(String(b.salon.name || ''), locale);
    }
    if (sortBy === 'most-booked') {
      return (b.services?.length || 0) - (a.services?.length || 0);
    }
    if (sortBy === 'top-rated') {
      return String(a.salon.slug || '').localeCompare(String(b.salon.slug || ''), locale);
    }
    return new Date(String(b.salon.created_at || 0)).getTime() - new Date(String(a.salon.created_at || 0)).getTime();
  });

  const socialProofText =
    sorted.length <= 5
      ? tx(messages, 'explore.socialProofEarly', 'Centers that started using CareChair ({{count}})', {count: sorted.length})
      : tx(messages, 'explore.socialProof', 'Centers using CareChair to organize bookings ({{count}})', {count: sorted.length});
  const platformWhatsapp = normalizeIraqiPhone(
    process.env.NEXT_PUBLIC_PLATFORM_WHATSAPP_NUMBER || process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || ''
  );
  const hasPlatformWhatsapp = isValidE164WithoutPlus(platformWhatsapp);

  return (
    <PageShell title={tx(messages, 'common.explore', 'Explore')} subtitle={tx(messages, 'explore.subtitle', 'Find salons by area and services')}>
      <div className="cc-section">
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

      <Card>
        <div className="category-chips-wrap">
          {categories.map((item) => (
            <Link
              key={item.key}
              href={`/explore?${new URLSearchParams({
                q: String(queryParams.q || ''),
                area: areaFilter,
                country: countryFilter,
                city: cityFilter,
                category: item.key,
                sort: sortBy
              }).toString()}`}
              className={`category-chip ${activeCategory.key === item.key ? 'active' : ''}`}
            >
              {item.label}
            </Link>
          ))}
        </div>

        <form className="grid three" method="get">
          <input type="hidden" name="country" value={countryFilter} />
          <input type="hidden" name="city" value={cityFilter} />
          <input type="hidden" name="category" value={activeCategory.key} />
          <label className="field">
            <span>{tx(messages, 'explore.filters.area', 'Area')}</span>
            <select name="area" defaultValue={areaFilter} className="input">
              <option value="">{tx(messages, 'explore.filters.allAreas', 'All areas')}</option>
              {areaOptions.map((item) => (
                <option value={item} key={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>{tx(messages, 'explore.filters.search', 'Search')}</span>
            <input name="q" defaultValue={String(queryParams.q || '')} className="input" placeholder={tx(messages, 'explore.filters.searchPlaceholder', 'Search by salon or service')} />
          </label>
          <label className="field">
            <span>{tx(messages, 'explore.filters.sort', 'Sort')}</span>
            <select name="sort" defaultValue={sortBy} className="input">
              <option value="nearest">{tx(messages, 'explore.sort.nearest', 'Nearest')}</option>
              <option value="top-rated">{tx(messages, 'explore.sort.topRated', 'Top rated')}</option>
              <option value="most-booked">{tx(messages, 'explore.sort.mostBooked', 'Most booked')}</option>
              <option value="newest">{tx(messages, 'explore.sort.newest', 'Newest')}</option>
            </select>
          </label>
          <button type="submit" className="ui-btn ui-btn-primary">
            {tx(messages, 'common.apply', 'Apply')}
          </button>
        </form>
      </Card>

      {error ? (
        <Card>
          <p className="muted">{tx(messages, 'explore.errors.loadFailed', 'Could not load salons right now.')}</p>
          <p className="muted">{error}</p>
          <div className="row-actions">
            {hasPlatformWhatsapp ? (
              <Button as="a" href={`https://wa.me/${platformWhatsapp}`} target="_blank" rel="noreferrer">
                {tx(messages, 'common.whatsappDemo', 'WhatsApp Demo')}
              </Button>
            ) : null}
            <Button as={Link as any} variant="secondary" href="/">
              {tx(messages, 'nav.home', 'Home')}
            </Button>
          </div>
        </Card>
      ) : sorted.length === 0 ? (
        <Card>
          <p className="muted">{tx(messages, 'explore.empty', 'No salons match the current filters.')}</p>
        </Card>
      ) : (
        <section className="explore-grid">
          {sorted.map(({salon, services}) => {
            const country = countrySlugFromSalon(salon);
            const city = citySlugFromSalon(salon);
            const href = `/${country}/${city}/${normalizeSlug(salon.slug)}`;
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
    </PageShell>
  );
}
