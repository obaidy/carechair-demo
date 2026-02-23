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
    <div className="cc-section superadmin-overview-panel">
      <section className="superadmin-kpi-grid">
        <article className="superadmin-kpi-card"><span>{t('superadmin.totalSalons', {defaultValue: 'Total salons'})}</span><strong>{totals.all}</strong></article>
        <article className="superadmin-kpi-card"><span>{t('superadmin.active', {defaultValue: 'Active'})}</span><strong>{totals.active}</strong></article>
        <article className="superadmin-kpi-card"><span>{t('superadmin.pending', {defaultValue: 'Pending'})}</span><strong>{totals.pending}</strong></article>
        <article className="superadmin-kpi-card"><span>{t('superadmin.suspended', {defaultValue: 'Suspended'})}</span><strong>{totals.suspended}</strong></article>
      </section>

      <section className="panel superadmin-table-card">
        <div className="superadmin-table-wrap">
          <table className="superadmin-table">
            <thead>
              <tr>
                <th>{t('common.name', {defaultValue: 'Name'})}</th>
                <th>{t('common.country', {defaultValue: 'Country'})}</th>
                <th>{t('common.status', {defaultValue: 'Status'})}</th>
                <th>{t('common.actions', {defaultValue: 'Actions'})}</th>
              </tr>
            </thead>
            <tbody>
              {salons.map((salon) => {
                const isPublic = Boolean(salon.is_public ?? salon.is_listed ?? false);

                return (
                  <tr key={salon.id}>
                    <td>
                      <strong>{salon.name}</strong>
                      <div className="muted">/{salon.slug}</div>
                    </td>
                    <td>{salon.country_code || '-'} • {salon.currency_code || '-'}</td>
                    <td>{String(salon.status || salon.subscription_status || 'draft')}</td>
                    <td>
                      <div className="row-actions superadmin-salon-actions">
                        <Link href={`/sa/${salon.id}`} className="ui-btn ui-btn-secondary">{t('common.view', {defaultValue: 'View'})}</Link>

                        <form action={superadminSalonAction}>
                          <input type="hidden" name="salonId" value={salon.id} />
                          <input type="hidden" name="action" value="approve_trial" />
                          <input type="hidden" name="path" value={`/${locale}/sa`} />
                          <button className="ui-btn ui-btn-secondary" type="submit">Approve trial</button>
                        </form>

                        <form action={superadminSalonAction}>
                          <input type="hidden" name="salonId" value={salon.id} />
                          <input type="hidden" name="action" value="suspend" />
                          <input type="hidden" name="path" value={`/${locale}/sa`} />
                          <button className="ui-btn ui-btn-secondary" type="submit">Suspend</button>
                        </form>

                        <form action={superadminSalonAction}>
                          <input type="hidden" name="salonId" value={salon.id} />
                          <input type="hidden" name="action" value="resume" />
                          <input type="hidden" name="path" value={`/${locale}/sa`} />
                          <button className="ui-btn ui-btn-secondary" type="submit">Resume</button>
                        </form>

                        <form action={superadminSalonAction}>
                          <input type="hidden" name="salonId" value={salon.id} />
                          <input type="hidden" name="action" value="toggle_visibility" />
                          <input type="hidden" name="isPublic" value={isPublic ? 'false' : 'true'} />
                          <input type="hidden" name="path" value={`/${locale}/sa`} />
                          <button className="ui-btn ui-btn-secondary" type="submit">{isPublic ? 'Hide' : 'Show'} explore</button>
                        </form>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
