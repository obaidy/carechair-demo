import {redirect} from 'next/navigation';
import {
  createServiceAction,
  deleteServiceAction,
  saveServiceAssignmentsAction,
  toggleServiceAction,
  updateServiceAction
} from '@/lib/actions/dashboard';
import {getSessionSalon, getSalonServices, getSalonStaff, getSalonStaffServices} from '@/lib/data/dashboard';
import {getMessages, tx} from '@/lib/messages';
import type {Locale} from '@/lib/i18n';

type Props = {params: Promise<{locale: string}>};

export default async function ServicesPage({params}: Props) {
  const {locale} = await params;
  const messages = await getMessages(locale as Locale);

  const salon = await getSessionSalon();
  if (!salon) redirect(`/${locale}/login?error=session`);

  const [services, staff, links] = await Promise.all([
    getSalonServices(salon.id),
    getSalonStaff(salon.id),
    getSalonStaffServices(salon.id)
  ]);

  const staffById = new Map(staff.map((row) => [row.id, row]));
  const assignedByService = new Map<string, string[]>();
  for (const row of links) {
    const key = String(row.service_id);
    const current = assignedByService.get(key) || [];
    current.push(String(row.staff_id));
    assignedByService.set(key, current);
  }

  return (
    <div className="cc-section">
      <section className="panel hero-lite">
        <h1>{tx(messages, 'dashboard.services', 'Services')}</h1>
      </section>

      <section className="panel">
        <h2>{tx(messages, 'dashboard.addService', 'Add service')}</h2>
        <form action={createServiceAction} className="grid two service-form-grid">
          <input type="hidden" name="path" value={`/${locale}/app/services`} />
          <label className="field">
            <span>{tx(messages, 'dashboard.name', 'Name')}</span>
            <input className="input" name="name" required minLength={2} />
          </label>
          <label className="field">
            <span>{tx(messages, 'dashboard.duration', 'Duration (min)')}</span>
            <input className="input" name="durationMinutes" type="number" min={5} defaultValue={45} />
          </label>
          <label className="field">
            <span>{tx(messages, 'dashboard.price', 'Price')}</span>
            <input className="input" name="price" type="number" min={0} defaultValue={0} />
          </label>
          <label className="field">
            <span>{tx(messages, 'dashboard.sortOrder', 'Sort order')}</span>
            <input className="input" name="sortOrder" type="number" min={0} defaultValue={0} />
          </label>
          <button className="btn btn-primary" type="submit">
            {tx(messages, 'dashboard.add', 'Add')}
          </button>
        </form>
      </section>

      <section className="settings-list">
        {services.length === 0 ? (
          <div className="empty-box">{tx(messages, 'admin.services.noServices', 'No services.')}</div>
        ) : (
          services.map((service) => {
            const assignedStaffIds = assignedByService.get(service.id) || [];
            const assignedStaff = assignedStaffIds.map((id) => staffById.get(id)?.name).filter(Boolean) as string[];

            return (
              <article className="settings-row service-row-main" key={service.id}>
                <form action={updateServiceAction} className="grid two">
                  <input type="hidden" name="path" value={`/${locale}/app/services`} />
                  <input type="hidden" name="serviceId" value={service.id} />
                  <input type="hidden" name="isActive" value={service.is_active ? 'true' : 'false'} />
                  <label className="field">
                    <span>{tx(messages, 'dashboard.name', 'Name')}</span>
                    <input className="input" name="name" defaultValue={service.name} required minLength={2} />
                  </label>
                  <label className="field">
                    <span>{tx(messages, 'dashboard.duration', 'Duration (min)')}</span>
                    <input className="input" name="durationMinutes" type="number" min={5} defaultValue={service.duration_minutes || 45} />
                  </label>
                  <label className="field">
                    <span>{tx(messages, 'dashboard.price', 'Price')}</span>
                    <input className="input" name="price" type="number" min={0} defaultValue={service.price || 0} />
                  </label>
                  <label className="field">
                    <span>{tx(messages, 'dashboard.sortOrder', 'Sort order')}</span>
                    <input className="input" name="sortOrder" type="number" min={0} defaultValue={service.sort_order || 0} />
                  </label>
                  <div className="field">
                    <span>{tx(messages, 'admin.services.providedBy', 'Provided by:')}</span>
                    <p className="muted">{assignedStaff.length > 0 ? assignedStaff.join(', ') : tx(messages, 'admin.services.noAssignment', 'No assignment')}</p>
                  </div>
                  <div className="row-actions service-row-actions">
                    <button type="submit" className="btn btn-secondary">
                      {tx(messages, 'common.save', 'Save')}
                    </button>
                  </div>
                </form>

                <form action={saveServiceAssignmentsAction} className="service-assign-inline">
                  <b>{tx(messages, 'admin.services.assignEmployees', 'Assign employees')}</b>
                  <div className="service-assign-grid">
                    <input type="hidden" name="path" value={`/${locale}/app/services`} />
                    <input type="hidden" name="serviceId" value={service.id} />

                    {staff.length === 0 ? (
                      <div className="empty-box">{tx(messages, 'admin.services.addStaffFirst', 'Add employees first to assign this service.')}</div>
                    ) : (
                      staff.map((member) => (
                        <label key={`${service.id}-${member.id}`} className="service-assign-chip">
                          <input type="checkbox" name="staffIds" value={member.id} defaultChecked={assignedStaffIds.includes(member.id)} />
                          {member.name}
                        </label>
                      ))
                    )}
                  </div>

                  <div className="row-actions">
                    <button type="submit" className="btn btn-secondary">
                      {tx(messages, 'admin.services.saveAssignment', 'Save assignment')}
                    </button>
                  </div>
                </form>

                <div className="row-actions service-row-actions">
                  <form action={toggleServiceAction}>
                    <input type="hidden" name="path" value={`/${locale}/app/services`} />
                    <input type="hidden" name="serviceId" value={service.id} />
                    <input type="hidden" name="isActive" value={service.is_active ? 'true' : 'false'} />
                    <button type="submit" className="btn btn-secondary">
                      {service.is_active
                        ? tx(messages, 'admin.services.hideService', 'Hide service')
                        : tx(messages, 'admin.services.showService', 'Show service')}
                    </button>
                  </form>

                  <form action={deleteServiceAction}>
                    <input type="hidden" name="path" value={`/${locale}/app/services`} />
                    <input type="hidden" name="serviceId" value={service.id} />
                    <button type="submit" className="ui-btn ui-btn-danger">
                      {tx(messages, 'common.delete', 'Delete')}
                    </button>
                  </form>
                </div>
              </article>
            );
          })
        )}
      </section>
    </div>
  );
}
