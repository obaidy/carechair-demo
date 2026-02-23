import {getLocale, getMessages} from 'next-intl/server';
import {Link} from '@/i18n/navigation';
import {tx} from '@/lib/messages';

export default async function LocaleNotFound() {
  const locale = await getLocale();
  const messages = await getMessages({locale});

  return (
    <main className="site-main">
      <div className="container page-stack">
        <section className="hero-card">
          <p className="eyebrow">404</p>
          <h1>{tx(messages, 'common.notFound', 'Page not found')}</h1>
          <p>{tx(messages, 'common.notFoundHint', 'The page you requested does not exist.')}</p>
          <Link href="/" className="btn btn-primary">
            {tx(messages, 'nav.home', 'Home')}
          </Link>
        </section>
      </div>
    </main>
  );
}
