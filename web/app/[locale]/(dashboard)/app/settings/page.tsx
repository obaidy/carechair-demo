import {redirect} from 'next/navigation';
import {updateSalonSettingsAction, updateSalonVisibilityAction} from '@/lib/actions/dashboard';
import {getSessionSalon} from '@/lib/data/dashboard';
import {getMessages, tx} from '@/lib/messages';
import type {Locale} from '@/lib/i18n';

type Props = {params: Promise<{locale: string}>};

export default async function SettingsPage({params}: Props) {
  const {locale} = await params;
  const messages = await getMessages(locale as Locale);

  const salon = await getSessionSalon();
  if (!salon) redirect(`/${locale}/login?error=session`);

  const isPublic = Boolean(salon.is_public ?? salon.is_listed ?? false);

  return (
    <div className="cc-section settings-grid">
      <section className="panel hero-lite">
        <h1>{tx(messages, 'dashboard.settings', 'Settings')}</h1>
      </section>

      <section className="panel settings-list">
        <h2>{tx(messages, 'dashboard.visibility', 'Visibility on explore')}</h2>
        <article className="settings-row">
          <div>
            <strong>{tx(messages, 'dashboard.visibility', 'Visibility on explore')}</strong>
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
        <h2>{tx(messages, 'admin.settings.salon', 'Salon settings')}</h2>
        <form action={updateSalonSettingsAction} className="settings-row">
          <input type="hidden" name="path" value={`/${locale}/app/settings`} />
          <label className="field">
            <span>{tx(messages, 'admin.settings.bookingMode', 'Booking mode')}</span>
            <select className="input" name="bookingMode" defaultValue={String((salon as Record<string, unknown>).booking_mode || 'choose_employee')}>
              <option value="choose_employee">{tx(messages, 'admin.settings.bookingModeChoose', 'Customer chooses employee')}</option>
              <option value="auto_assign">{tx(messages, 'admin.settings.bookingModeAuto', 'Auto assign by availability')}</option>
            </select>
          </label>
          <label className="field">
            <span>{tx(messages, 'admin.settings.defaultLanguage', 'Default language')}</span>
            <select className="input" name="languageDefault" defaultValue={String((salon as Record<string, unknown>).language_default || 'en')}>
              <option value="ar">ar</option>
              <option value="en">en</option>
              <option value="cs">cs</option>
              <option value="ru">ru</option>
            </select>
          </label>
          <div className="row-actions">
            <button className="btn btn-secondary" type="submit">{tx(messages, 'common.save', 'Save')}</button>
          </div>
        </form>
      </section>

      <section className="panel settings-list">
        <h2>{tx(messages, 'dashboard.account', 'Account')}</h2>
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
