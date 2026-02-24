import {getLocale, getMessages} from 'next-intl/server';
import {Link} from '@/i18n/navigation';
import {tx} from '@/lib/messages';

export default async function ForbiddenPage() {
  const locale = await getLocale();
  const messages = await getMessages({locale});

  return (
    <div className="platform-page">
      <main className="platform-main">
        <section className="panel hero-lite">
          <h1>{tx(messages, 'common.forbidden', 'Access denied')}</h1>
          <p>{tx(messages, 'common.forbiddenHint', 'You do not have permission to open this page.')}</p>
          <div className="row-actions">
            <Link href="/" className="btn btn-primary">
              {tx(messages, 'nav.home', 'Home')}
            </Link>
            <Link href="/login?force=1" className="btn btn-secondary">
              {tx(messages, 'nav.login', 'Login')}
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
