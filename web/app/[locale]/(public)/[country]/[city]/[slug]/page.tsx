import type {Metadata} from 'next';
import {notFound} from 'next/navigation';
import {getMessages} from 'next-intl/server';
import BookingForm from '@/components/BookingForm';
import {tx} from '@/lib/messages';
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
      description: tx(messages, 'salon.metaDescription', 'View salon profile, services, and book online.'),
      pathname: `/${country}/${city}/${slug}`
    });
  }

  const serviceRows = await getServiceListingData(country, city, slug);
  if (serviceRows.length > 0) {
    const serviceName = decodeURIComponent(slug).replace(/-/g, ' ');
    return buildMetadata({
      title: `${serviceName} salons | CareChair`,
      description: tx(messages, 'service.metaDescription', 'Find salons offering this service and book online.'),
      pathname: `/${country}/${city}/${slug}`
    });
  }

  return buildMetadata({
    title: 'CareChair',
    description: tx(messages, 'meta.defaultDescription', 'Find salons and book instantly.'),
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
      <div className="cc-container cc-section">
        <section className="cc-section">
          <h1>{decodeURIComponent(slug).replace(/-/g, ' ')}</h1>
          <p className="muted">{tx(messages, 'service.subtitle', 'Salons that currently offer this service.')}</p>
        </section>

        <section className="explore-grid">
          {serviceRows.map(({salon, services}) => (
            <article className="panel" key={salon.id}>
              <div>
                <h2>{salon.name}</h2>
                <p className="muted">{salon.area || '-'}</p>
                <p className="muted">{services.map((item) => item.name).join(' • ')}</p>
                <Link
                  href={`/${countrySlugFromSalon(salon)}/${citySlugFromSalon(salon)}/${normalizeSlug(salon.slug)}`}
                  className="btn btn-primary"
                >
                  {tx(messages, 'service.bookSalon', 'Book this salon')}
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
    <div className="cc-container cc-section">
      <script type="application/ld+json" dangerouslySetInnerHTML={{__html: JSON.stringify(jsonLd)}} />

      <section className="panel hero-lite">
        <h2>{salon.name}</h2>
        <p>{address || salon.area || tx(messages, 'salon.addressUnavailable', 'Address unavailable')}</p>
      </section>

      <section className="grid two">
        <article className="booking-card">
          <h3>{tx(messages, 'salon.directions', 'Directions')}</h3>
          <p className="muted">{address || tx(messages, 'salon.addressUnavailable', 'Address unavailable')}</p>

          <div className="row-actions">
            {appleDirections ? (
              <a href={appleDirections} target="_blank" rel="noreferrer" className="btn btn-secondary">
                {tx(messages, 'salon.appleMaps', 'Apple Maps')}
              </a>
            ) : null}
            {googleDirections ? (
              <a href={googleDirections} target="_blank" rel="noreferrer" className="btn btn-secondary">
                {tx(messages, 'salon.googleMaps', 'Google Maps')}
              </a>
            ) : null}
          </div>

          <div>
            {staticMapUrl ? (
              <img
                src={staticMapUrl}
                alt={address || tx(messages, 'salon.mapPreview', 'Location preview')}
                style={{width: '100%', maxWidth: '100%', borderRadius: '12px', display: 'block'}}
              />
            ) : (
              <div className="booking-map-placeholder">{tx(messages, 'salon.mapUnavailable', 'Map preview unavailable')}</div>
            )}
          </div>
        </article>

        <article className="booking-card">
          <h3>{tx(messages, 'salon.hours', 'Working hours')}</h3>
          <ul className="hours-list">
            {hours.map((row) => (
              <li key={`${row.day_of_week}-${row.open_time}-${row.close_time}`}>
                <span>{dayLabel(row.day_of_week)}</span>
                <span>
                  {row.is_closed
                    ? tx(messages, 'salon.closed', 'Closed')
                    : `${String(row.open_time || '').slice(0, 5)} - ${String(row.close_time || '').slice(0, 5)}`}
                </span>
              </li>
            ))}
          </ul>

          <h3>{tx(messages, 'salon.services', 'Services')}</h3>
          <ul className="staff-chips">
            {services.map((service) => (
              <li key={service.id} className="staff-chip">
                {service.name}
              </li>
            ))}
          </ul>

          <h3>{tx(messages, 'salon.staff', 'Staff')}</h3>
          <ul className="staff-chips">
            {staff.map((member) => (
              <li key={member.id} className="staff-chip">
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
