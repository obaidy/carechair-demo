import {redirect} from 'next/navigation';
import {getTranslations} from 'next-intl/server';
import {updateSalonVisibilityAction} from '@/lib/actions/dashboard';
import {getSessionSalon} from '@/lib/data/dashboard';

type Props = {params: Promise<{locale: string}>};

export default async function SettingsPage({params}: Props) {
  const {locale} = await params;
  const t = await getTranslations();

  const salon = await getSessionSalon();
  if (!salon) redirect(`/${locale}/login?error=session`);

  const isPublic = Boolean(salon.is_public ?? salon.is_listed ?? false);

  return (
    <div className="cc-section settings-grid">
      <section className="panel hero-lite">
        <h1>{t('dashboard.settings', {defaultValue: 'Settings'})}</h1>
      </section>

      <section className="panel settings-list">
        <h2>{t('dashboard.visibility', {defaultValue: 'Visibility on explore'})}</h2>
        <article className="settings-row">
          <div>
            <strong>{t('dashboard.visibility', {defaultValue: 'Visibility on explore'})}</strong>
            <p className="muted">{isPublic ? 'Public' : 'Private'}</p>
          </div>

          <form action={updateSalonVisibilityAction} className="row-actions">
            <input type="hidden" name="path" value={`/${locale}/app/settings`} />
            <input type="hidden" name="isPublic" value={isPublic ? 'false' : 'true'} />
            <button className="btn btn-primary" type="submit">{isPublic ? 'Hide from explore' : 'Show on explore'}</button>
          </form>
        </article>
      </section>

      <section className="panel settings-list">
        <h2>{t('dashboard.account', {defaultValue: 'Account'})}</h2>
        <article className="settings-row">
          <div>
            <strong>Slug</strong>
            <p className="muted">{salon.slug}</p>
          </div>
        </article>
        <article className="settings-row">
          <div>
            <strong>Country</strong>
            <p className="muted">{salon.country_code || '-'}</p>
          </div>
        </article>
        <article className="settings-row">
          <div>
            <strong>Currency</strong>
            <p className="muted">{salon.currency_code || '-'}</p>
          </div>
        </article>
      </section>
    </div>
  );
}
