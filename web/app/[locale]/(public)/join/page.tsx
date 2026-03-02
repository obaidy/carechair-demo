import {getMessages} from 'next-intl/server';
import PageShell from '@/components/PageShell';
import IdentityLoginCard from '@/components/auth/IdentityLoginCard';
import {tx} from '@/lib/messages';
import type {Locale} from '@/lib/i18n';

type Props = {
  params: Promise<{locale: string}>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function JoinPage({params, searchParams}: Props) {
  const {locale} = await params;
  const query = await searchParams;
  const messages = await getMessages({locale});
  const inviteToken = String(query.token || '').trim();
  const inviteCode = String(query.code || '').trim().toUpperCase();
  const errorCode = String(query.error || '');

  return (
    <PageShell
      title={tx(messages, 'team.joinTitle', 'Join salon')}
      subtitle={tx(messages, 'team.joinSubtitle', 'Verify your phone, accept the invite, and open the same dashboard on web or mobile.')}
      mobileMenuDisabled
    >
      <section className="panel hero-lite">
        <h2>{tx(messages, 'team.joinTitle', 'Join salon')}</h2>
        <p className="muted">
          {inviteToken || inviteCode
            ? tx(messages, 'team.joinTokenDetected', 'Invite detected. Sign in to join this salon.')
            : tx(messages, 'team.joinManual', 'Enter your phone number and invite code to join a salon team.')}
        </p>
      </section>

      {errorCode ? <p className="muted" style={{color: 'var(--danger)'}}>{errorCode.replace(/_/g, ' ')}</p> : null}

      <section className="grid two">
        <IdentityLoginCard
          locale={locale}
          nextPath={`/${locale}/app`}
          defaultRole="salon_admin"
          inviteToken={inviteToken}
          inviteCode={inviteCode}
        />
      </section>
    </PageShell>
  );
}
