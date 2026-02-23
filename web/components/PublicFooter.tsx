'use client';

import Link from 'next/link';
import {useLocale} from 'next-intl';
import BrandLogo from '@/components/BrandLogo';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import {useTx} from '@/lib/messages-client';
import {isValidE164WithoutPlus, normalizeIraqiPhone} from '@/lib/phone';

export default function PublicFooter() {
  const locale = useLocale();
  const t = useTx();
  const year = new Date().getFullYear();
  const platformWhatsapp = normalizeIraqiPhone(process.env.NEXT_PUBLIC_PLATFORM_WHATSAPP_NUMBER || process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || '');
  const hasWhatsapp = isValidE164WithoutPlus(platformWhatsapp);
  const demoMessage = encodeURIComponent(t('footer.demoWhatsappMessage', 'Hello, I want to request a CareChair demo for my salon.'));

  return (
    <footer className="site-footer">
      <div className="site-footer-inner footer-desktop-grid">
        <section className="footer-col">
          <BrandLogo className="footer-brand" />
          <p className="footer-brand-line">
            {t('footer.tagline', 'CareChair is a professional booking platform for salons and beauty centers.')}
          </p>
          {hasWhatsapp ? (
            <a className="footer-wa-cta" href={`https://wa.me/${platformWhatsapp}?text=${demoMessage}`} target="_blank" rel="noreferrer">
              {t('common.bookDemo', 'Book Demo')}
            </a>
          ) : null}
        </section>

        <section className="footer-col">
          <h5>{t('footer.links', 'Links')}</h5>
          <Link href={`/${locale}/explore`}>{t('common.explore', 'Explore')}</Link>
          <a href={`/${locale}/#owners`}>{t('nav.centers', 'For Salons')}</a>
          <a href={`/${locale}/#pricing`}>{t('nav.pricing', 'Pricing')}</a>
          <a href={`/${locale}/#faq`}>{t('nav.faq', 'FAQ')}</a>
        </section>

        <section className="footer-col">
          <h5>{t('footer.legal', 'Legal')}</h5>
          <a href="https://carechairdemo.netlify.app/terms">{t('footer.terms', 'Terms')}</a>
          <a href="https://carechairdemo.netlify.app/privacy">{t('footer.privacy', 'Privacy')}</a>
          <a href="https://carechairdemo.netlify.app/billing">{t('footer.billing', 'Billing & Refund')}</a>
          <a href="https://carechairdemo.netlify.app/cancellation">{t('footer.cancellation', 'Cancellation')}</a>
        </section>

        <section className="footer-col">
          <h5>{t('footer.contact', 'Contact')}</h5>
          <a href="mailto:aka.obaidy@gmail.com">aka.obaidy@gmail.com</a>
          {hasWhatsapp ? (
            <a href={`https://wa.me/${platformWhatsapp}`} target="_blank" rel="noreferrer">
              {t('footer.whatsappLabel', 'WhatsApp')}: {platformWhatsapp}
            </a>
          ) : (
            <span>{t('footer.whatsappUnavailable', 'WhatsApp is currently unavailable')}</span>
          )}
          <LanguageSwitcher />
        </section>
      </div>

      <div className="site-footer-inner footer-mobile-stack">
        <section className="footer-mobile-brand">
          <BrandLogo className="footer-brand" />
          <p className="footer-brand-line">
            {t('footer.tagline', 'CareChair is a professional booking platform for salons and beauty centers.')}
          </p>
          {hasWhatsapp ? (
            <a className="footer-wa-cta footer-mobile-cta" href={`https://wa.me/${platformWhatsapp}?text=${demoMessage}`} target="_blank" rel="noreferrer">
              {t('common.bookDemo', 'Book Demo')}
            </a>
          ) : null}
          <LanguageSwitcher />
        </section>

        <section className="footer-mobile-group">
          <h5>{t('footer.links', 'Links')}</h5>
          <div className="footer-mobile-links">
            <Link href={`/${locale}/explore`}>{t('common.explore', 'Explore')}</Link>
            <a href={`/${locale}/#owners`}>{t('nav.centers', 'For Salons')}</a>
            <a href={`/${locale}/#pricing`}>{t('nav.pricing', 'Pricing')}</a>
            <a href={`/${locale}/#faq`}>{t('nav.faq', 'FAQ')}</a>
          </div>
        </section>

        <section className="footer-mobile-group">
          <h5>{t('footer.legal', 'Legal')}</h5>
          <div className="footer-mobile-links">
            <a href="https://carechairdemo.netlify.app/terms">{t('footer.terms', 'Terms')}</a>
            <a href="https://carechairdemo.netlify.app/privacy">{t('footer.privacy', 'Privacy')}</a>
            <a href="https://carechairdemo.netlify.app/billing">{t('footer.billing', 'Billing & Refund')}</a>
            <a href="https://carechairdemo.netlify.app/cancellation">{t('footer.cancellation', 'Cancellation')}</a>
          </div>
        </section>

        <section className="footer-mobile-group">
          <h5>{t('footer.contact', 'Contact')}</h5>
          <div className="footer-mobile-links footer-mobile-contact">
            {hasWhatsapp ? (
              <a href={`https://wa.me/${platformWhatsapp}`} target="_blank" rel="noreferrer">
                {t('footer.whatsappLabel', 'WhatsApp')}: {platformWhatsapp}
              </a>
            ) : (
              <span>{t('footer.whatsappUnavailable', 'WhatsApp is currently unavailable')}</span>
            )}
            <a href="mailto:aka.obaidy@gmail.com">aka.obaidy@gmail.com</a>
          </div>
        </section>
      </div>

      <div className="site-footer-bottom">
        <p>{t('footer.legalLine', 'CareChair is operated by Infraengineering s.r.o.')}</p>
        <small>© {year} Infraengineering s.r.o. | IČO: 24192953 | Praha</small>
      </div>
    </footer>
  );
}
