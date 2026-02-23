import {getTranslations} from 'next-intl/server';
import {Link} from '@/i18n/navigation';

type Props = {params: Promise<{locale: string}>};

export default async function ForbiddenPage({params}: Props) {
  await params;
  const t = await getTranslations();

  return (
    <main className="site-main">
      <div className="container page-stack">
        <section className="hero-card">
          <p className="eyebrow">403</p>
          <h1>{t('common.forbidden', {defaultValue: 'Access denied'})}</h1>
          <p>{t('common.forbiddenHint', {defaultValue: 'You do not have permission to open this page.'})}</p>
          <div className="row-actions">
            <Link href="/" className="btn btn-primary">
              {t('nav.home', {defaultValue: 'Home'})}
            </Link>
            <Link href="/login" className="btn btn-secondary">
              {t('nav.login', {defaultValue: 'Login'})}
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
