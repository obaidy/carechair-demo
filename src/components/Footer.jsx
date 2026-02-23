import React from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { isValidE164WithoutPlus, normalizeIraqiPhone } from "../lib/utils";
import BrandLogo from "./BrandLogo";
import LanguageSwitcher from "./LanguageSwitcher";

export default function Footer() {
  const { t, i18n } = useTranslation();
  const year = new Date().getFullYear();
  const platformWhatsapp = normalizeIraqiPhone(
    import.meta.env.VITE_PLATFORM_WHATSAPP_NUMBER || import.meta.env.VITE_WHATSAPP_NUMBER || ""
  );
  const hasWhatsapp = isValidE164WithoutPlus(platformWhatsapp);
  const demoMessage = encodeURIComponent(t("footer.demoWhatsappMessage"));

  return (
    <footer className="site-footer" dir={i18n.dir()}>
      <div className="site-footer-inner footer-desktop-grid">
        <section className="footer-col">
          <BrandLogo className="footer-brand" />
          <p className="footer-brand-line">{t("footer.tagline")}</p>
          {hasWhatsapp ? (
            <a
              className="footer-wa-cta"
              href={`https://wa.me/${platformWhatsapp}?text=${demoMessage}`}
              target="_blank"
              rel="noreferrer"
            >
              {t("common.bookDemo")}
            </a>
          ) : null}
        </section>

        <section className="footer-col">
          <h5>{t("footer.links")}</h5>
          <Link to="/explore">{t("common.explore")}</Link>
          <Link to="/#owners">{t("nav.centers")}</Link>
          <Link to="/pricing">{t("nav.pricing")}</Link>
          <Link to="/#faq">{t("nav.faq")}</Link>
        </section>

        <section className="footer-col">
          <h5>{t("footer.legal")}</h5>
          <Link to="/terms">{t("footer.terms")}</Link>
          <Link to="/privacy">{t("footer.privacy")}</Link>
          <Link to="/billing">{t("footer.billing")}</Link>
          <Link to="/cancellation">{t("footer.cancellation")}</Link>
        </section>

        <section className="footer-col">
          <h5>{t("footer.contact")}</h5>
          <a href="mailto:aka.obaidy@gmail.com">aka.obaidy@gmail.com</a>
          {hasWhatsapp ? (
            <a href={`https://wa.me/${platformWhatsapp}`} target="_blank" rel="noreferrer">
              {t("footer.whatsappLabel")}: {platformWhatsapp}
            </a>
          ) : (
            <span>{t("footer.whatsappUnavailable")}</span>
          )}
          <LanguageSwitcher />
        </section>
      </div>

      <div className="site-footer-inner footer-mobile-stack">
        <section className="footer-mobile-brand">
          <BrandLogo className="footer-brand" />
          <p className="footer-brand-line">{t("footer.tagline")}</p>
          {hasWhatsapp ? (
            <a
              className="footer-wa-cta footer-mobile-cta"
              href={`https://wa.me/${platformWhatsapp}?text=${demoMessage}`}
              target="_blank"
              rel="noreferrer"
            >
              {t("common.bookDemo")}
            </a>
          ) : null}
          <LanguageSwitcher />
        </section>

        <section className="footer-mobile-group">
          <h5>{t("footer.links")}</h5>
          <div className="footer-mobile-links">
            <Link to="/explore">{t("common.explore")}</Link>
            <Link to="/#owners">{t("nav.centers")}</Link>
            <Link to="/pricing">{t("nav.pricing")}</Link>
            <Link to="/#faq">{t("nav.faq")}</Link>
          </div>
        </section>

        <section className="footer-mobile-group">
          <h5>{t("footer.legal")}</h5>
          <div className="footer-mobile-links">
            <Link to="/terms">{t("footer.terms")}</Link>
            <Link to="/privacy">{t("footer.privacy")}</Link>
            <Link to="/billing">{t("footer.billing")}</Link>
            <Link to="/cancellation">{t("footer.cancellation")}</Link>
          </div>
        </section>

        <section className="footer-mobile-group">
          <h5>{t("footer.contact")}</h5>
          <div className="footer-mobile-links footer-mobile-contact">
            {hasWhatsapp ? (
              <a href={`https://wa.me/${platformWhatsapp}`} target="_blank" rel="noreferrer">
                {t("footer.whatsappLabel")}: {platformWhatsapp}
              </a>
            ) : (
              <span>{t("footer.whatsappUnavailable")}</span>
            )}
            <a href="mailto:aka.obaidy@gmail.com">aka.obaidy@gmail.com</a>
          </div>
        </section>
      </div>

      <div className="site-footer-bottom">
        <p>{t("footer.legalLine")}</p>
        <small>© {year} Infraengineering s.r.o. | IČO: 24192953 | Praha</small>
      </div>
    </footer>
  );
}
