import {redirect} from 'next/navigation';
import {getTranslations} from 'next-intl/server';
import {createServiceAction, toggleServiceAction} from '@/lib/actions/dashboard';
import {getSessionSalon, getSalonServices} from '@/lib/data/dashboard';

type Props = {params: Promise<{locale: string}>};

export default async function ServicesPage({params}: Props) {
  const {locale} = await params;
  const t = await getTranslations();

  const salon = await getSessionSalon();
  if (!salon) redirect(`/${locale}/login?error=session`);

  const services = await getSalonServices(salon.id);

  return (
    <div className="cc-section">
      <section className="panel hero-lite">
        <h1>{t('dashboard.services', {defaultValue: 'Services'})}</h1>
      </section>

      <section className="panel">
        <h2>{t('dashboard.addService', {defaultValue: 'Add service'})}</h2>
        <form action={createServiceAction} className="grid two service-form-grid">
          <input type="hidden" name="path" value={`/${locale}/app/services`} />
          <label className="field"><span>{t('dashboard.name', {defaultValue: 'Name'})}</span><input className="input" name="name" required minLength={2} /></label>
          <label className="field"><span>{t('dashboard.duration', {defaultValue: 'Duration (min)'})}</span><input className="input" name="durationMinutes" type="number" min={5} defaultValue={45} /></label>
          <label className="field"><span>{t('dashboard.price', {defaultValue: 'Price'})}</span><input className="input" name="price" type="number" min={0} defaultValue={0} /></label>
          <label className="field"><span>{t('dashboard.sortOrder', {defaultValue: 'Sort order'})}</span><input className="input" name="sortOrder" type="number" min={0} defaultValue={0} /></label>
          <button className="btn btn-primary" type="submit">{t('dashboard.add', {defaultValue: 'Add'})}</button>
        </form>
      </section>

      <section className="settings-list">
        {services.map((service) => (
          <article className="settings-row service-row-main" key={service.id}>
            <div>
              <strong>{service.name}</strong>
              <p className="muted">{service.duration_minutes} min • {service.price ?? 0}</p>
              <span className="switch-pill">{service.is_active ? 'Active' : 'Inactive'}</span>
            </div>
            <form action={toggleServiceAction} className="row-actions service-row-actions">
              <input type="hidden" name="path" value={`/${locale}/app/services`} />
              <input type="hidden" name="serviceId" value={service.id} />
              <input type="hidden" name="isActive" value={service.is_active ? 'true' : 'false'} />
              <button type="submit" className="btn btn-secondary">{service.is_active ? 'Disable' : 'Enable'}</button>
            </form>
          </article>
        ))}
      </section>
    </div>
  );
}
