import {redirect} from 'next/navigation';
import {getTranslations} from 'next-intl/server';
import {Link} from '@/i18n/navigation';
import {readAuthSession} from '@/lib/auth/server';
import {superadminSalonAction} from '@/lib/actions/dashboard';
import {getSuperadminSalons} from '@/lib/data/dashboard';

type Props = {params: Promise<{locale: string}>};

export default async function SuperadminOverviewPage({params}: Props) {
  const {locale} = await params;
  const t = await getTranslations();

  const session = await readAuthSession();
  if (!session || session.role !== 'superadmin') {
    redirect(`/${locale}/login?error=superadmin`);
  }

  const salons = await getSuperadminSalons();

  const totals = {
    all: salons.length,
    active: salons.filter((row) => Boolean(row.is_active)).length,
    suspended: salons.filter((row) => String(row.status || '') === 'suspended').length,
    pending: salons.filter((row) => String(row.status || '') === 'pending_approval').length
  };

  return (
    <div className="cc-section">
      <section className="kpi-grid">
        <article className="kpi-card"><span>{t('superadmin.totalSalons', {defaultValue: 'Total salons'})}</span><strong>{totals.all}</strong></article>
        <article className="kpi-card"><span>{t('superadmin.active', {defaultValue: 'Active'})}</span><strong>{totals.active}</strong></article>
        <article className="kpi-card"><span>{t('superadmin.pending', {defaultValue: 'Pending'})}</span><strong>{totals.pending}</strong></article>
        <article className="kpi-card"><span>{t('superadmin.suspended', {defaultValue: 'Suspended'})}</span><strong>{totals.suspended}</strong></article>
      </section>

      <section className="grid">
        {salons.map((salon) => {
          const isPublic = Boolean(salon.is_public ?? salon.is_listed ?? false);

          return (
            <article key={salon.id} className="booking-card">
              <div className="booking-info">
                <h3>{salon.name}</h3>
                <p className="muted">/{salon.slug}</p>
                <p className="muted">{salon.country_code || '-'} • {salon.currency_code || '-'}</p>
                <p className="muted">{String(salon.status || salon.subscription_status || 'draft')}</p>
              </div>

              <div className="row-actions">
                <Link href={`/sa/${salon.id}`} className="btn btn-secondary">{t('common.view', {defaultValue: 'View'})}</Link>

                <form action={superadminSalonAction}>
                  <input type="hidden" name="salonId" value={salon.id} />
                  <input type="hidden" name="action" value="approve_trial" />
                  <input type="hidden" name="path" value={`/${locale}/sa`} />
                  <button className="btn btn-secondary" type="submit">Approve trial</button>
                </form>

                <form action={superadminSalonAction}>
                  <input type="hidden" name="salonId" value={salon.id} />
                  <input type="hidden" name="action" value="suspend" />
                  <input type="hidden" name="path" value={`/${locale}/sa`} />
                  <button className="btn btn-secondary" type="submit">Suspend</button>
                </form>

                <form action={superadminSalonAction}>
                  <input type="hidden" name="salonId" value={salon.id} />
                  <input type="hidden" name="action" value="resume" />
                  <input type="hidden" name="path" value={`/${locale}/sa`} />
                  <button className="btn btn-secondary" type="submit">Resume</button>
                </form>

                <form action={superadminSalonAction}>
                  <input type="hidden" name="salonId" value={salon.id} />
                  <input type="hidden" name="action" value="toggle_visibility" />
                  <input type="hidden" name="isPublic" value={isPublic ? 'false' : 'true'} />
                  <input type="hidden" name="path" value={`/${locale}/sa`} />
                  <button className="btn btn-secondary" type="submit">{isPublic ? 'Hide' : 'Show'} explore</button>
                </form>
              </div>
            </article>
          );
        })}
      </section>
    </div>
  );
}
