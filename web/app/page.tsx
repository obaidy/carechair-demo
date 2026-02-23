import Link from 'next/link';
import {getMessages} from 'next-intl/server';
import {t} from '@/lib/messages';
import {buildMetadata} from '@/lib/seo';
import {getExploreData, citySlugFromSalon, countrySlugFromSalon} from '@/lib/data/public';

export async function generateMetadata() {
  const messages = await getMessages();

  return buildMetadata({
    title: t(messages, 'home.metaTitle', 'CareChair | Book salons online'),
    description: t(messages, 'home.metaDescription', 'Discover salons, compare services, and book in minutes.'),
    pathname: '/'
  });
}

export default async function HomePage() {
  const messages = await getMessages();

  const exploreRows = await getExploreData();
  const featured = exploreRows.slice(0, 6);

  return (
    <div className="container page-stack">
      <section className="hero-card">
        <p className="eyebrow">{t(messages, 'home.eyebrow', 'Public SEO Pages')}</p>
        <h1>{t(messages, 'home.title', 'Book trusted salons in seconds')}</h1>
        <p>{t(messages, 'home.subtitle', 'Search by city, compare services, and reserve your slot instantly.')}</p>
        <div className="hero-actions">
          <Link href="/explore" className="btn btn-primary">
            {t(messages, 'home.ctaExplore', 'Explore salons')}
          </Link>
        </div>
      </section>

      <section className="section-stack">
        <h2>{t(messages, 'home.featured', 'Featured salons')}</h2>

        <div className="card-grid">
          {featured.map(({salon, services}) => (
            <article className="salon-card" key={salon.id}>
              <div className="salon-card__media" />
              <div className="salon-card__body">
                <h3>{salon.name}</h3>
                <p className="muted">{salon.area || '-'}</p>
                <p className="muted">
                  {services.slice(0, 3).map((service) => service.name).join(' • ') || t(messages, 'common.noData', 'No data')}
                </p>
                <Link
                  href={`/${countrySlugFromSalon(salon)}/${citySlugFromSalon(salon)}/${salon.slug}`}
                  className="btn btn-secondary"
                >
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
