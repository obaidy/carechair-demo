import {redirect} from 'next/navigation';
import {getTranslations} from 'next-intl/server';
import {createStaffAction, toggleStaffAction} from '@/lib/actions/dashboard';
import {getSessionSalon, getSalonStaff} from '@/lib/data/dashboard';

type Props = {params: Promise<{locale: string}>};

export default async function StaffPage({params}: Props) {
  const {locale} = await params;
  const t = await getTranslations();

  const salon = await getSessionSalon();
  if (!salon) redirect(`/${locale}/login?error=session`);

  const staff = await getSalonStaff(salon.id);

  return (
    <div className="cc-section">
      <section className="panel hero-lite">
        <h1>{t('dashboard.staff', {defaultValue: 'Staff'})}</h1>
      </section>

      <section className="panel">
        <h2>{t('dashboard.addStaff', {defaultValue: 'Add staff member'})}</h2>
        <form action={createStaffAction} className="grid two">
          <input type="hidden" name="path" value={`/${locale}/app/staff`} />
          <label className="field">
            <span>{t('dashboard.name', {defaultValue: 'Name'})}</span>
            <input className="input" name="name" required minLength={2} />
          </label>
          <label className="field">
            <span>{t('dashboard.sortOrder', {defaultValue: 'Sort order'})}</span>
            <input className="input" type="number" name="sortOrder" defaultValue={0} min={0} />
          </label>
          <button className="btn btn-primary" type="submit">{t('dashboard.add', {defaultValue: 'Add'})}</button>
        </form>
      </section>

      <section className="grid">
        {staff.map((member) => (
          <article className="booking-card" key={member.id}>
            <div className="booking-info">
              <h3>{member.name}</h3>
              <p className="muted">{member.is_active ? 'Active' : 'Inactive'}</p>
            </div>
            <form action={toggleStaffAction}>
              <input type="hidden" name="path" value={`/${locale}/app/staff`} />
              <input type="hidden" name="staffId" value={member.id} />
              <input type="hidden" name="isActive" value={member.is_active ? 'true' : 'false'} />
              <button type="submit" className="btn btn-secondary">{member.is_active ? 'Disable' : 'Enable'}</button>
            </form>
          </article>
        ))}
      </section>
    </div>
  );
}
