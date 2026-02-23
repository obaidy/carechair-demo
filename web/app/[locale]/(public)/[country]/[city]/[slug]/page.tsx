import type {Metadata} from 'next';
import {notFound} from 'next/navigation';
import {getMessages} from 'next-intl/server';
import BookingForm from '@/components/BookingForm';
import {t} from '@/lib/messages';
import {buildMetadata} from '@/lib/seo';
import {Link} from '@/i18n/navigation';
import {
  citySlugFromSalon,
  countrySlugFromSalon,
  getPublicSalonByPath,
  getServiceListingData
} from '@/lib/data/public';
import {
  buildAppleDirectionsUrl,
  buildGoogleDirectionsUrl,
  buildMapboxStaticPreviewUrl,
  formatAddress
} from '@/lib/maps';
import {normalizeSlug} from '@/lib/slug';

type PageProps = {
  params: Promise<{locale: string; country: string; city: string; slug: string}>;
};

function dayLabel(index: number): string {
  const labels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return labels[index] || String(index);
}

export async function generateMetadata({params}: PageProps): Promise<Metadata> {
  const {locale, country, city, slug} = await params;
  const messages = await getMessages({locale});

  const salonPayload = await getPublicSalonByPath(country, city, slug);
  if (salonPayload) {
    return buildMetadata({
      title: `${salonPayload.salon.name} | CareChair`,
      description: t(messages, 'salon.metaDescription', 'View salon profile, services, and book online.'),
      pathname: `/${country}/${city}/${slug}`
    });
  }

  const serviceRows = await getServiceListingData(country, city, slug);
  if (serviceRows.length > 0) {
    const serviceName = decodeURIComponent(slug).replace(/-/g, ' ');
    return buildMetadata({
      title: `${serviceName} salons | CareChair`,
      description: t(messages, 'service.metaDescription', 'Find salons offering this service and book online.'),
      pathname: `/${country}/${city}/${slug}`
    });
  }

  return buildMetadata({
    title: 'CareChair',
    description: t(messages, 'meta.defaultDescription', 'Find salons and book instantly.'),
    pathname: `/${country}/${city}/${slug}`
  });
}

export default async function SlugPage({params}: PageProps) {
  const {locale, country, city, slug} = await params;
  const messages = await getMessages({locale});

  const salonPayload = await getPublicSalonByPath(country, city, slug);

  if (!salonPayload) {
    const serviceRows = await getServiceListingData(country, city, slug);
    if (!serviceRows.length) {
      notFound();
    }

    return (
      <div className="container page-stack">
        <section className="section-stack">
          <h1>{decodeURIComponent(slug).replace(/-/g, ' ')}</h1>
          <p className="muted">{t(messages, 'service.subtitle', 'Salons that currently offer this service.')}</p>
        </section>

        <section className="card-grid">
          {serviceRows.map(({salon, services}) => (
            <article className="salon-card" key={salon.id}>
              <div className="salon-card__body">
                <h2>{salon.name}</h2>
                <p className="muted">{salon.area || '-'}</p>
                <p className="muted">{services.map((item) => item.name).join(' • ')}</p>
                <Link
                  href={`/${countrySlugFromSalon(salon)}/${citySlugFromSalon(salon)}/${normalizeSlug(salon.slug)}`}
                  className="btn btn-primary"
                >
                  {t(messages, 'service.bookSalon', 'Book this salon')}
                </Link>
              </div>
            </article>
          ))}
        </section>
      </div>
    );
  }

  const {salon, location, services, staff, staffServices, hours, employeeHours} = salonPayload;

  const address = formatAddress(location);
  const staticMapUrl = buildMapboxStaticPreviewUrl(location?.lat, location?.lng, 600, 300);
  const googleDirections = buildGoogleDirectionsUrl(location?.lat, location?.lng, address);
  const appleDirections = buildAppleDirectionsUrl(location?.lat, location?.lng, address);
  const openingHours = (hours || [])
    .filter((row) => !row.is_closed && row.open_time && row.close_time)
    .map((row) => {
      const day = dayLabel(row.day_of_week);
      const open = String(row.open_time || '').slice(0, 5);
      const close = String(row.close_time || '').slice(0, 5);
      return `${day} ${open}-${close}`;
    });

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: salon.name,
    address: {
      '@type': 'PostalAddress',
      streetAddress: location?.address_line || salon.area || '',
      addressLocality: location?.city || salon.area || '',
      addressCountry: location?.country_code || salon.country_code || ''
    },
    geo:
      location && Number.isFinite(location.lat) && Number.isFinite(location.lng)
        ? {
            '@type': 'GeoCoordinates',
            latitude: location.lat,
            longitude: location.lng
          }
        : undefined,
    url: `/${country}/${city}/${slug}`,
    telephone: salon.whatsapp || undefined,
    openingHours: openingHours.length > 0 ? openingHours : undefined
  };

  return (
    <div className="container page-stack">
      <script type="application/ld+json" dangerouslySetInnerHTML={{__html: JSON.stringify(jsonLd)}} />

      <section className="hero-card">
        <h1 className="hero-title-clamp">{salon.name}</h1>
        <p>{address || salon.area || t(messages, 'salon.addressUnavailable', 'Address unavailable')}</p>
      </section>

      <section className="salon-layout-grid">
        <article className="salon-info-card">
          <h2>{t(messages, 'salon.directions', 'Directions')}</h2>
          <p className="muted">{address || t(messages, 'salon.addressUnavailable', 'Address unavailable')}</p>

          <div className="row-actions">
            {appleDirections ? (
              <a href={appleDirections} target="_blank" rel="noreferrer" className="btn btn-secondary">
                {t(messages, 'salon.appleMaps', 'Apple Maps')}
              </a>
            ) : null}
            {googleDirections ? (
              <a href={googleDirections} target="_blank" rel="noreferrer" className="btn btn-secondary">
                {t(messages, 'salon.googleMaps', 'Google Maps')}
              </a>
            ) : null}
          </div>

          <div className="map-preview-wrap">
            {staticMapUrl ? (
              <img
                src={staticMapUrl}
                alt={address || t(messages, 'salon.mapPreview', 'Location preview')}
                className="map-preview"
              />
            ) : (
              <div className="map-placeholder">{t(messages, 'salon.mapUnavailable', 'Map preview unavailable')}</div>
            )}
          </div>
        </article>

        <article className="salon-info-card">
          <h2>{t(messages, 'salon.hours', 'Working hours')}</h2>
          <ul className="hours-list">
            {hours.map((row) => (
              <li key={`${row.day_of_week}-${row.open_time}-${row.close_time}`}>
                <span>{dayLabel(row.day_of_week)}</span>
                <span>
                  {row.is_closed
                    ? t(messages, 'salon.closed', 'Closed')
                    : `${String(row.open_time || '').slice(0, 5)} - ${String(row.close_time || '').slice(0, 5)}`}
                </span>
              </li>
            ))}
          </ul>

          <h3>{t(messages, 'salon.services', 'Services')}</h3>
          <ul className="chip-list">
            {services.map((service) => (
              <li key={service.id} className="chip">
                {service.name}
              </li>
            ))}
          </ul>

          <h3>{t(messages, 'salon.staff', 'Staff')}</h3>
          <ul className="chip-list">
            {staff.map((member) => (
              <li key={member.id} className="chip">
                {member.name}
              </li>
            ))}
          </ul>
        </article>
      </section>

      <BookingForm
        salon={salon}
        services={services}
        staff={staff}
        staffServices={staffServices}
        hours={hours}
        employeeHours={employeeHours}
      />
    </div>
  );
}
