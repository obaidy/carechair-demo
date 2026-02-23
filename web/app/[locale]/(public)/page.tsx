import {getMessages} from 'next-intl/server';
import {t} from '@/lib/messages';
import {buildMetadata} from '@/lib/seo';
import {getExploreData, citySlugFromSalon, countrySlugFromSalon} from '@/lib/data/public';
import {Link} from '@/i18n/navigation';

type Props = {params: Promise<{locale: string}>};

export async function generateMetadata({params}: Props) {
  const {locale} = await params;
  const messages = await getMessages({locale});

  return buildMetadata({
    title: t(messages, 'home.metaTitle', 'CareChair | Book salons online'),
    description: t(messages, 'home.metaDescription', 'Discover salons, compare services, and book in minutes.'),
    pathname: '/'
  });
}

export default async function HomePage({params}: Props) {
  const {locale} = await params;
  const messages = await getMessages({locale});

  const exploreRows = await getExploreData();
  const featured = exploreRows.slice(0, 6);

  return (
    <div className="container page-stack">
      <section className="landing-hero" id="owners">
        <div className="landing-hero-copy">
          <p className="eyebrow">CareChair</p>
          <h1 className="hero-title-clamp">{t(messages, 'home.title', 'Book trusted salons in seconds')}</h1>
          <p className="hero-subtitle">{t(messages, 'home.subtitle', 'Search by city, compare services, and reserve your slot instantly.')}</p>
          <div className="hero-actions">
            <Link href="/explore" className="btn btn-primary">
              {t(messages, 'home.ctaExplore', 'Explore salons')}
            </Link>
            <Link href="/login" className="btn btn-secondary">Dashboard</Link>
          </div>
        </div>

        <div className="landing-hero-visual" id="features" aria-hidden="true">
          <div className="hero-kpi-card">
            <span>Active salons</span>
            <strong>{Math.max(42, exploreRows.length)}</strong>
          </div>
          <div className="hero-kpi-card">
            <span>Live cities</span>
            <strong>{new Set(exploreRows.map((item) => item.salon.area || '')).size || 8}</strong>
          </div>
          <div className="hero-kpi-card">
            <span>Avg booking flow</span>
            <strong>45s</strong>
          </div>
        </div>
      </section>

      <section className="stats-strip" id="pricing">
        <article><strong>+1200</strong><span>Monthly bookings</span></article>
        <article><strong>4.9/5</strong><span>Customer rating</span></article>
        <article><strong>24/7</strong><span>Online booking</span></article>
      </section>

      <section className="section-stack" id="faq">
        <h2>{t(messages, 'home.featured', 'Featured salons')}</h2>

        <div className="card-grid">
          {featured.map(({salon, services, location}) => (
            <article className="salon-card" key={salon.id}>
              <div className="salon-card__media" />
              <div className="salon-card__body">
                <h3>{salon.name}</h3>
                <p className="muted">{location?.formatted_address || location?.address_line || salon.area || '-'}</p>
                <p className="muted">{services.slice(0, 3).map((service) => service.name).join(' • ') || t(messages, 'common.noData', 'No data')}</p>
                <Link href={`/${countrySlugFromSalon(salon)}/${citySlugFromSalon(salon)}/${salon.slug}`} className="btn btn-secondary">
                  {t(messages, 'home.bookNow', 'Book now')}
                </Link>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
