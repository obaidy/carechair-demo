import {getTranslations} from 'next-intl/server';
import {Link} from '@/i18n/navigation';

type Props = {params: Promise<{locale: string}>};

export default async function LocaleNotFound({params}: Props) {
  await params;
  const t = await getTranslations();

  return (
    <main className="site-main">
      <div className="container page-stack">
        <section className="hero-card">
          <p className="eyebrow">404</p>
          <h1>{t('common.notFound', {defaultValue: 'Page not found'})}</h1>
          <p>{t('common.notFoundHint', {defaultValue: 'The page you requested does not exist.'})}</p>
          <Link href="/" className="btn btn-primary">
            {t('nav.home', {defaultValue: 'Home'})}
          </Link>
        </section>
      </div>
    </main>
  );
}
