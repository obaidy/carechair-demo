import {getMessages} from 'next-intl/server';
import {Link} from '@/i18n/navigation';
import {tx} from '@/lib/messages';

type Props = {params: Promise<{locale: string}>};

export default async function ForbiddenPage({params}: Props) {
  const {locale} = await params;
  const messages = await getMessages({locale});

  return (
    <main className="site-main">
      <div className="container page-stack">
        <section className="hero-card">
          <p className="eyebrow">403</p>
          <h1>{tx(messages, 'common.forbidden', 'Access denied')}</h1>
          <p>{tx(messages, 'common.forbiddenHint', 'You do not have permission to open this page.')}</p>
          <div className="row-actions">
            <Link href="/" className="btn btn-primary">
              {tx(messages, 'nav.home', 'Home')}
            </Link>
            <Link href="/login" className="btn btn-secondary">
              {tx(messages, 'nav.login', 'Login')}
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
