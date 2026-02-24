import {redirect} from 'next/navigation';
import {createStaffAction, deleteStaffAction, toggleStaffAction, updateStaffAction} from '@/lib/actions/dashboard';
import {getSessionSalon, getSalonStaff, getSalonStaffServices} from '@/lib/data/dashboard';
import {getMessages, tx} from '@/lib/messages';
import type {Locale} from '@/lib/i18n';

type Props = {params: Promise<{locale: string}>};

export default async function StaffPage({params}: Props) {
  const {locale} = await params;
  const messages = await getMessages(locale as Locale);

  const salon = await getSessionSalon();
  if (!salon) redirect(`/${locale}/login?error=session`);

  const [staff, assignments] = await Promise.all([getSalonStaff(salon.id), getSalonStaffServices(salon.id)]);
  const assignmentsByStaff = new Map<string, number>();
  for (const row of assignments) {
    const key = String(row.staff_id);
    assignmentsByStaff.set(key, (assignmentsByStaff.get(key) || 0) + 1);
  }

  return (
    <div className="cc-section">
      <section className="panel hero-lite">
        <h1>{tx(messages, 'dashboard.staff', 'Staff')}</h1>
      </section>

      <section className="panel">
        <h2>{tx(messages, 'dashboard.addStaff', 'Add staff member')}</h2>
        <form action={createStaffAction} className="grid two service-form-grid">
          <input type="hidden" name="path" value={`/${locale}/app/staff`} />
          <label className="field">
            <span>{tx(messages, 'dashboard.name', 'Name')}</span>
            <input className="input" name="name" required minLength={2} />
          </label>
          <label className="field">
            <span>{tx(messages, 'dashboard.sortOrder', 'Sort order')}</span>
            <input className="input" type="number" name="sortOrder" defaultValue={0} min={0} />
          </label>
          <button className="btn btn-primary" type="submit">
            {tx(messages, 'dashboard.add', 'Add')}
          </button>
        </form>
      </section>

      <section className="settings-list">
        {staff.length === 0 ? (
          <div className="empty-box">{tx(messages, 'admin.employees.noEmployees', 'No employees.')}</div>
        ) : (
          staff.map((member) => (
            <article className="settings-row staff-row-main" key={member.id}>
              <form action={updateStaffAction} className="grid two">
                <input type="hidden" name="path" value={`/${locale}/app/staff`} />
                <input type="hidden" name="staffId" value={member.id} />
                <label className="field">
                  <span>{tx(messages, 'dashboard.name', 'Name')}</span>
                  <input className="input" name="name" defaultValue={member.name} required minLength={2} />
                </label>
                <label className="field">
                  <span>{tx(messages, 'dashboard.sortOrder', 'Sort order')}</span>
                  <input className="input" type="number" name="sortOrder" min={0} defaultValue={member.sort_order || 0} />
                </label>
                <label className="field">
                  <span>{tx(messages, 'admin.employees.photoUrlOptional', 'Photo URL (optional)')}</span>
                  <input className="input" type="url" name="photoUrl" defaultValue={String(member.photo_url || '')} />
                </label>
                <div className="field">
                  <span>{tx(messages, 'admin.services.assigned', 'Assigned')}</span>
                  <p className="muted">{assignmentsByStaff.get(member.id) || 0}</p>
                </div>
                <div className="row-actions service-row-actions">
                  <button type="submit" className="btn btn-secondary">
                    {tx(messages, 'common.save', 'Save')}
                  </button>
                </div>
              </form>

              <div className="row-actions service-row-actions">
                <form action={toggleStaffAction}>
                  <input type="hidden" name="path" value={`/${locale}/app/staff`} />
                  <input type="hidden" name="staffId" value={member.id} />
                  <input type="hidden" name="isActive" value={member.is_active ? 'true' : 'false'} />
                  <button type="submit" className="btn btn-secondary">
                    {member.is_active
                      ? tx(messages, 'admin.employees.hideEmployee', 'Hide employee')
                      : tx(messages, 'admin.employees.showEmployee', 'Show employee')}
                  </button>
                </form>

                <form action={deleteStaffAction}>
                  <input type="hidden" name="path" value={`/${locale}/app/staff`} />
                  <input type="hidden" name="staffId" value={member.id} />
                  <button type="submit" className="ui-btn ui-btn-danger">
                    {tx(messages, 'common.delete', 'Delete')}
                  </button>
                </form>
              </div>
            </article>
          ))
        )}
      </section>
    </div>
  );
}
