import {Link} from '@/i18n/navigation';
import {tx} from '@/lib/messages';

type Props = {
  locale: string;
  salon: {
    slug?: string | null;
    status?: string | null;
  };
  messages: Record<string, any>;
};

function normalizeStatus(value: unknown) {
  const key = String(value || '').trim().toLowerCase();
  if (key === 'active' || key === 'trialing' || key === 'past_due') return 'active';
  if (key === 'suspended') return 'suspended';
  if (key === 'pending_review' || key === 'pending_approval') return 'pending';
  return 'draft';
}

export default function StatusBanner({locale, salon, messages}: Props) {
  const status = normalizeStatus(salon.status);
  const bookingLink = salon.slug ? `/${locale}/s/${salon.slug}` : '';

  if (status === 'active') {
    return (
      <section className="panel" style={{borderColor: 'var(--success)'}}>
        <p className="muted" style={{color: 'var(--success)'}}>
          <strong>{tx(messages, 'status.active', 'Active')}</strong>
        </p>
        <p className="muted">{tx(messages, 'billingAccess.unlockMessages.active', 'Your salon is active. Public booking and reminders are enabled.')}</p>
        <div className="row-actions">
          {bookingLink ? <Link href={bookingLink} className="btn btn-secondary">{tx(messages, 'booking.bookNow', 'Booking page')}</Link> : null}
          <Link href="/app/settings" className="btn btn-primary">{tx(messages, 'dashboard.settings', 'Settings')}</Link>
        </div>
      </section>
    );
  }

  if (status === 'pending') {
    return (
      <section className="panel" style={{borderColor: 'var(--warning)'}}>
        <p className="muted" style={{color: 'var(--warning)'}}>
          <strong>{tx(messages, 'status.pending_approval', 'Pending approval')}</strong>
        </p>
        <p className="muted">{tx(messages, 'billingAccess.lockMessages.pendingApproval', 'Your activation request is under review.')}</p>
        <div className="row-actions">
          <Link href="/app/settings" className="btn btn-secondary">{tx(messages, 'dashboard.settings', 'Update profile')}</Link>
        </div>
      </section>
    );
  }

  if (status === 'suspended') {
    return (
      <section className="panel" style={{borderColor: 'var(--danger)'}}>
        <p className="muted" style={{color: 'var(--danger)'}}>
          <strong>{tx(messages, 'status.suspended', 'Suspended')}</strong>
        </p>
        <p className="muted">{tx(messages, 'billingAccess.lockMessages.suspended', 'Your salon is suspended. Contact support to reactivate.')}</p>
        <div className="row-actions">
          <a className="btn btn-secondary" href="https://wa.me/964" target="_blank" rel="noreferrer">
            {tx(messages, 'common.support', 'Support')}
          </a>
        </div>
      </section>
    );
  }

  return (
    <section className="panel" style={{borderColor: 'var(--line)'}}>
      <p className="muted">
        <strong>{tx(messages, 'status.draft', 'Draft')}</strong>
      </p>
      <p className="muted">{tx(messages, 'dashboard.draftBanner', 'Your salon is not activated yet. Complete your profile then request activation.')}</p>
      <div className="row-actions">
        <Link href="/app/settings#activation" className="btn btn-primary">{tx(messages, 'dashboard.requestActivation', 'Request activation')}</Link>
      </div>
    </section>
  );
}
