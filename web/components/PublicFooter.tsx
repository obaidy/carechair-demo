import {getTranslations} from 'next-intl/server';

export default async function PublicFooter({locale}: {locale: string}) {
  const t = await getTranslations();

  return (
    <footer className="site-footer">
      <div className="container footer-grid">
        <div className="footer-col">
          <h3>CareChair</h3>
          <p>{t('meta.defaultDescription', {defaultValue: 'Find salons and book instantly.'})}</p>
        </div>

        <div className="footer-col">
          <h4>{t('nav.explore', {defaultValue: 'Explore'})}</h4>
          <a href={`/${locale}/explore`}>Explore</a>
          <a href={`/${locale}/#features`}>Features</a>
          <a href={`/${locale}/#pricing`}>Pricing</a>
        </div>

        <div className="footer-col">
          <h4>Company</h4>
          <a href="https://carechairdemo.netlify.app/terms">Terms</a>
          <a href="https://carechairdemo.netlify.app/privacy">Privacy</a>
          <a href="mailto:hello@carechair.com">hello@carechair.com</a>
        </div>
      </div>
      <div className="container footer-bottom">© {new Date().getFullYear()} CareChair</div>
    </footer>
  );
}
