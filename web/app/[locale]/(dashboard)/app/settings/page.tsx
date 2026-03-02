import {redirect} from 'next/navigation';
import {deleteMyAccountAction, updateOwnerSalonProfileAction, updateReminderRuleAction, updateSalonSettingsAction, updateSalonVisibilityAction} from '@/lib/actions/dashboard';
import ActivationRequestCard from '@/components/dashboard/ActivationRequestCard';
import {getSessionSalon} from '@/lib/data/dashboard';
import {getMessages, tx} from '@/lib/messages';
import type {Locale} from '@/lib/i18n';
import {createServiceSupabaseClient} from '@/lib/supabase/service';

type Props = {params: Promise<{locale: string}>};

export default async function SettingsPage({params}: Props) {
  const {locale} = await params;
  const messages = await getMessages(locale as Locale);

  const salon = await getSessionSalon();
  if (!salon) redirect(`/${locale}/login?error=session`);

  const reminderDefaults = [
    {channel: 'sms', type: 'booking_confirmed'},
    {channel: 'whatsapp', type: 'booking_reminder_24h'},
    {channel: 'whatsapp', type: 'booking_reminder_2h'},
    {channel: 'push', type: 'booking_confirmed'}
  ];

  const service = createServiceSupabaseClient();
  if (service) {
    await service.from('salon_reminders').upsert(
      reminderDefaults.map((row) => ({
        salon_id: String(salon.id),
        channel: row.channel,
        type: row.type,
        enabled: false
      })),
      {onConflict: 'salon_id,channel,type'}
    );
  }

  const remindersRes = service
    ? await service
        .from('salon_reminders')
        .select('id,channel,type,enabled')
        .eq('salon_id', salon.id)
        .order('channel', {ascending: true})
    : {data: [], error: null};
  const reminders = remindersRes.data || [];

  const isPublic = Boolean(salon.is_public ?? salon.is_listed ?? false);

  return (
    <div className="cc-section settings-grid">
      <section className="panel hero-lite">
        <h1>{tx(messages, 'dashboard.settings', 'Settings')}</h1>
      </section>

      <section className="panel settings-list">
        <h2>{tx(messages, 'admin.settings.salon', 'Salon profile')}</h2>
        <form action={updateOwnerSalonProfileAction} className="settings-row">
          <input type="hidden" name="path" value={`/${locale}/app/settings`} />
          <label className="field">
            <span>{tx(messages, 'admin.settings.name', 'Name')}</span>
            <input className="input" name="name" defaultValue={String(salon.name || '')} required minLength={2} />
          </label>
          <label className="field">
            <span>{tx(messages, 'admin.settings.category', 'Category')}</span>
            <input className="input" name="category" defaultValue={String((salon as Record<string, unknown>).category || '')} />
          </label>
          <label className="field">
            <span>{tx(messages, 'admin.settings.whatsapp', 'WhatsApp')}</span>
            <input className="input" name="whatsapp" defaultValue={String(salon.whatsapp || '')} />
          </label>
          <label className="field">
            <span>{tx(messages, 'explore.filters.area', 'Area')}</span>
            <input className="input" name="area" defaultValue={String(salon.area || '')} />
          </label>
          <label className="field">
            <span>{tx(messages, 'onboarding.fields.city', 'City')}</span>
            <input className="input" name="city" defaultValue={String((salon as Record<string, unknown>).city || '')} />
          </label>
          <label className="field">
            <span>Address mode</span>
            <select className="input" name="addressMode" defaultValue={String((salon as Record<string, unknown>).address_mode || 'MANUAL')}>
              <option value="MANUAL">MANUAL</option>
              <option value="LOCATION">LOCATION</option>
            </select>
          </label>
          <label className="field">
            <span>Address text</span>
            <input className="input" name="addressText" defaultValue={String((salon as Record<string, unknown>).address_text || '')} />
          </label>
          <label className="field">
            <span>Latitude</span>
            <input className="input" name="locationLat" defaultValue={String((salon as Record<string, unknown>).location_lat || '')} />
          </label>
          <label className="field">
            <span>Longitude</span>
            <input className="input" name="locationLng" defaultValue={String((salon as Record<string, unknown>).location_lng || '')} />
          </label>
          <label className="field">
            <span>Accuracy (m)</span>
            <input className="input" name="locationAccuracyM" defaultValue={String((salon as Record<string, unknown>).location_accuracy_m || '')} />
          </label>
          <label className="field">
            <span>Location label</span>
            <input className="input" name="locationLabel" defaultValue={String((salon as Record<string, unknown>).location_label || '')} />
          </label>
          <div className="row-actions">
            <button className="btn btn-secondary" type="submit">{tx(messages, 'common.save', 'Save')}</button>
          </div>
        </form>
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

      <ActivationRequestCard
        salonId={String(salon.id)}
        locale={locale}
        salonStatus={String((salon as Record<string, unknown>).status || '')}
        defaultValues={{
          whatsapp: salon.whatsapp || null,
          city: String((salon as Record<string, unknown>).city || '') || null,
          area: salon.area || null,
          address_mode: String((salon as Record<string, unknown>).address_mode || 'MANUAL'),
          address_text: String((salon as Record<string, unknown>).address_text || '') || null,
          location_lat: Number((salon as Record<string, unknown>).location_lat || 0) || null,
          location_lng: Number((salon as Record<string, unknown>).location_lng || 0) || null,
          location_accuracy_m: Number((salon as Record<string, unknown>).location_accuracy_m || 0) || null,
          location_label: String((salon as Record<string, unknown>).location_label || '') || null
        }}
      />

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
        <h2>{tx(messages, 'admin.settings.reminders', 'Reminders')}</h2>
        {reminders.map((row: any) => (
          <article className="settings-row" key={String(row.id)}>
            <div>
              <strong>{String(row.channel || '').toUpperCase()} • {String(row.type || '')}</strong>
              <p className="muted">{Boolean(row.enabled) ? 'Enabled' : 'Disabled'}</p>
            </div>
            <form action={updateReminderRuleAction} className="row-actions">
              <input type="hidden" name="path" value={`/${locale}/app/settings`} />
              <input type="hidden" name="reminderId" value={String(row.id)} />
              <input type="hidden" name="enabled" value={Boolean(row.enabled) ? 'false' : 'true'} />
              <button className="btn btn-secondary" type="submit">{Boolean(row.enabled) ? 'Disable' : 'Enable'}</button>
            </form>
          </article>
        ))}
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
        <article className="settings-row">
          <div>
            <strong>{tx(messages, 'dashboard.deleteAccount', 'Delete account')}</strong>
            <p className="muted">
              {tx(messages, 'dashboard.deleteAccountHint', 'This permanently deletes your account and any salons you own.')}
            </p>
          </div>
          <form action={deleteMyAccountAction} className="row-actions">
            <input type="hidden" name="locale" value={locale} />
            <button className="btn btn-danger" type="submit">
              {tx(messages, 'dashboard.deleteAccount', 'Delete account')}
            </button>
          </form>
        </article>
      </section>
    </div>
  );
}
