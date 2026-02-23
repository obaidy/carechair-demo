import type {Metadata} from 'next';
import {notFound} from 'next/navigation';
import {getMessages} from 'next-intl/server';
import BookingForm from '@/components/BookingForm';
import SafeImage from '@/components/SafeImage';
import {Button, Card} from '@/components/ui';
import {tx} from '@/lib/messages';
import {buildMetadata} from '@/lib/seo';
import {Link} from '@/i18n/navigation';
import {
  citySlugFromSalon,
  countrySlugFromSalon,
  getPublicSalonByPathSafe,
  getServiceListingDataSafe
} from '@/lib/data/public';
import {
  buildAppleDirectionsUrl,
  buildGoogleDirectionsUrl,
  buildMapboxStaticPreviewUrl,
  formatAddress
} from '@/lib/maps';
import {normalizeSlug} from '@/lib/slug';
import {formatSalonOperationalCurrency} from '@/lib/format';
import {getDefaultAvatar, getInitials, getSalonMedia, getServiceImage} from '@/lib/media';
import {isValidE164WithoutPlus, normalizeIraqiPhone} from '@/lib/phone';
import {resolveImageSrcServer} from '@/lib/images-server';
import PageShell from '@/components/PageShell';

type PageProps = {
  params: Promise<{locale: string; country: string; city: string; slug: string}>;
};

function dayLabel(index: number, locale: string): string {
  try {
    const date = new Date(Date.UTC(2024, 0, 7 + index));
    return new Intl.DateTimeFormat(locale.startsWith('ar') ? 'ar-IQ' : locale, {weekday: 'short'}).format(date);
  } catch {
    const labels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return labels[index] || String(index);
  }
}

export async function generateMetadata({params}: PageProps): Promise<Metadata> {
  const {locale, country, city, slug} = await params;
  const messages = await getMessages({locale});

  const salonPayloadResult = await getPublicSalonByPathSafe(country, city, slug);
  if (salonPayloadResult.data) {
    return buildMetadata({
      title: `${salonPayloadResult.data.salon.name} | CareChair`,
      description: tx(messages, 'salon.metaDescription', 'View salon profile, services, and book online.'),
      pathname: `/${country}/${city}/${slug}`
    });
  }

  const serviceRowsResult = await getServiceListingDataSafe(country, city, slug);
  if (serviceRowsResult.data.length > 0) {
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

  const {data: salonPayload, error: salonError} = await getPublicSalonByPathSafe(country, city, slug);

  if (!salonPayload) {
    const {data: serviceRows, error: serviceError} = await getServiceListingDataSafe(country, city, slug);

    if (salonError && serviceError) {
      return (
        <PageShell title={decodeURIComponent(slug).replace(/-/g, ' ')} subtitle={tx(messages, 'service.subtitle', 'Salons that currently offer this service.')}>
          <Card>
            <p className="muted">{tx(messages, 'service.loadError', 'Could not load this page right now.')}</p>
            <p className="muted">{salonError}</p>
          </Card>
        </PageShell>
      );
    }

    if (!serviceRows.length) {
      notFound();
    }

    return (
      <PageShell title={decodeURIComponent(slug).replace(/-/g, ' ')} subtitle={tx(messages, 'service.subtitle', 'Salons that currently offer this service.')}>
        <section className="explore-grid">
          {serviceRows.map(({salon, services}) => (
            <article className="booking-card" key={salon.id}>
              <div className="booking-info">
                <h2>{salon.name}</h2>
                <p className="muted">{salon.area || '-'}</p>
                <p className="muted">{services.map((item) => item.name).join(' • ')}</p>
              </div>
              <div className="row-actions">
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
      </PageShell>
    );
  }

  const {salon, location, services, staff, staffServices, hours, employeeHours} = salonPayload;
  const media = getSalonMedia(salon);

  const [coverImage, logoImage, galleryImages, serviceImages, staffImages] = await Promise.all([
    resolveImageSrcServer(salon.cover_image_url || media.cover, 'cover'),
    resolveImageSrcServer(salon.logo_url || '', 'logo'),
    Promise.all(media.gallery.map((img) => resolveImageSrcServer(img, 'gallery'))),
    Promise.all(
      services.map(async (service) => [service.id, await resolveImageSrcServer(service.image_url || getServiceImage(service.name), 'service')] as const)
    ),
    Promise.all(
      staff.map(async (member) => [member.id, await resolveImageSrcServer(member.photo_url || getDefaultAvatar(member.id || member.name), 'staff')] as const)
    )
  ]);

  const serviceImageById = Object.fromEntries(serviceImages);
  const staffImageById = Object.fromEntries(staffImages);

  const address = formatAddress(location);
  const staticMapUrl = buildMapboxStaticPreviewUrl(location?.lat, location?.lng, 600, 300);
  const googleDirections = buildGoogleDirectionsUrl(location?.lat, location?.lng, address);
  const appleDirections = buildAppleDirectionsUrl(location?.lat, location?.lng, address);
  const openingHours = (hours || [])
    .filter((row) => !row.is_closed && row.open_time && row.close_time)
    .map((row) => {
      const day = dayLabel(row.day_of_week, locale);
      const open = String(row.open_time || '').slice(0, 5);
      const close = String(row.close_time || '').slice(0, 5);
      return `${day} ${open}-${close}`;
    });

  const whatsappPhone = normalizeIraqiPhone(salon.whatsapp || '');
  const hasWhatsapp = isValidE164WithoutPlus(whatsappPhone);

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
    <PageShell
      title={salon.name}
      subtitle={address || salon.area || tx(messages, 'salon.addressUnavailable', 'Address unavailable')}
      right={
        <Button as={Link as any} variant="ghost" href="/app">
          {tx(messages, 'booking.salonAdmin', 'Salon Admin')}
        </Button>
      }
    >
      <script type="application/ld+json" dangerouslySetInnerHTML={{__html: JSON.stringify(jsonLd)}} />

      <section className="salon-hero" style={{backgroundImage: `url('${coverImage}')`}}>
        <div className="salon-hero-overlay">
          <div className="salon-hero-content">
            <div className="salon-hero-brand">
              <SafeImage src={logoImage} alt={`${tx(messages, 'booking.salonLogo', 'Salon logo')} ${salon.name}`} className="salon-hero-logo" fallbackText={getInitials(salon.name)} fallbackKey="logo" />
              <div>
                <h2>{salon.name}</h2>
                <p>{salon.area || tx(messages, 'booking.defaultCity', 'City')}</p>
              </div>
            </div>
            <div className="row-actions">
              <Button as="a" href="#booking-form">
                {tx(messages, 'booking.bookNow', 'Book now')}
              </Button>
              {hasWhatsapp ? (
                <Button as="a" variant="secondary" href={`https://wa.me/${whatsappPhone}`} target="_blank" rel="noreferrer">
                  {tx(messages, 'booking.contactWhatsapp', 'Contact on WhatsApp')}
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      <Card className="booking-location-card">
        <h3 className="section-title">{tx(messages, 'booking.locationTitle', 'Location & Directions')}</h3>
        {location ? (
          <div className="booking-location-grid">
            <div className="booking-location-copy">
              <p className="booking-location-address">{address || tx(messages, 'booking.locationAddressUnavailable', 'Address unavailable')}</p>
              <div className="row-actions">
                {appleDirections ? (
                  <Button as="a" href={appleDirections} target="_blank" rel="noreferrer" variant="secondary">
                    {tx(messages, 'salon.appleMaps', 'Apple Maps')}
                  </Button>
                ) : null}
                {googleDirections ? (
                  <Button as="a" href={googleDirections} target="_blank" rel="noreferrer" variant="secondary">
                    {tx(messages, 'salon.googleMaps', 'Google Maps')}
                  </Button>
                ) : null}
              </div>
            </div>
            <div className="booking-location-preview">
              {staticMapUrl ? (
                <img
                  src={staticMapUrl}
                  alt={address || tx(messages, 'salon.mapPreview', 'Location preview')}
                  className="booking-static-map-image"
                />
              ) : (
                <div className="booking-map-placeholder">{tx(messages, 'salon.mapUnavailable', 'Map preview unavailable')}</div>
              )}
            </div>
          </div>
        ) : (
          <div className="booking-map-placeholder">{tx(messages, 'booking.locationUnavailable', 'Salon location is not available yet.')}</div>
        )}
      </Card>

      <Card>
        <h3 className="section-title">{tx(messages, 'booking.whyTitle', 'Why book with CareChair?')}</h3>
        <div className="trust-grid">
          <div className="trust-item">
            <b>{tx(messages, 'booking.trust.fastConfirm.title', 'Fast confirmation')}</b>
            <p>{tx(messages, 'booking.trust.fastConfirm.text', 'Your request goes instantly to the salon.')}</p>
          </div>
          <div className="trust-item">
            <b>{tx(messages, 'booking.trust.scheduling.title', 'Smart scheduling')}</b>
            <p>{tx(messages, 'booking.trust.scheduling.text', 'Only available times are shown to avoid conflicts.')}</p>
          </div>
          <div className="trust-item">
            <b>{tx(messages, 'booking.trust.noCalls.title', 'No calls needed')}</b>
            <p>{tx(messages, 'booking.trust.noCalls.text', 'Book in seconds without waiting on phone lines.')}</p>
          </div>
        </div>
      </Card>

      <Card>
        <h3 className="section-title">{tx(messages, 'booking.galleryTitle', 'Salon gallery')}</h3>
        <div className="gallery-grid">
          {galleryImages.map((img, idx) => (
            <SafeImage key={`${img}-${idx}`} src={img} alt={`${tx(messages, 'booking.image', 'Image')} ${idx + 1}`} className="gallery-tile" fallbackKey="gallery" />
          ))}
        </div>
      </Card>

      <Card>
        <h3 className="section-title">{tx(messages, 'salon.hours', 'Working hours')}</h3>
        <ul className="hours-list">
          {hours.map((row) => (
            <li key={`${row.day_of_week}-${row.open_time}-${row.close_time}`}>
              <span>{dayLabel(row.day_of_week, locale)}</span>
              <span>
                {row.is_closed
                  ? tx(messages, 'salon.closed', 'Closed')
                  : `${String(row.open_time || '').slice(0, 5)} - ${String(row.close_time || '').slice(0, 5)}`}
              </span>
            </li>
          ))}
        </ul>

        <h3 className="section-title">{tx(messages, 'salon.services', 'Services')}</h3>
        <div className="service-grid-compact">
          {services.map((service) => (
            <div key={service.id} className="service-mini-card active" aria-hidden="true">
              <SafeImage src={serviceImageById[service.id]} alt={service.name} className="service-mini-image" fallbackKey="service" />
              <div className="service-mini-meta">
                <b>{service.name}</b>
                <small>{tx(messages, 'booking.minutes', '{{count}} min', {count: service.duration_minutes})}</small>
                <span>{formatSalonOperationalCurrency(service.price, salon, locale)}</span>
              </div>
            </div>
          ))}
        </div>

        <h3 className="section-title">{tx(messages, 'salon.staff', 'Staff')}</h3>
        <div className="staff-avatar-grid">
          {staff.map((member) => (
            <div key={member.id} className="staff-avatar-card active" aria-hidden="true">
              <SafeImage src={staffImageById[member.id]} alt={member.name} className="staff-avatar-image" fallbackText={getInitials(member.name)} fallbackKey="staff" />
              <b>{member.name}</b>
            </div>
          ))}
        </div>
      </Card>

      <div id="booking-form">
        <Card>
          <BookingForm
            salon={salon}
            services={services}
            staff={staff}
            staffServices={staffServices}
            hours={hours}
            employeeHours={employeeHours}
          />
        </Card>
      </div>
    </PageShell>
  );
}
