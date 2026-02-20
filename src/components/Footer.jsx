import React from "react";
import { Link } from "react-router-dom";
import { isValidE164WithoutPlus, normalizeIraqiPhone } from "../lib/utils";
import BrandLogo from "./BrandLogo";

export default function Footer() {
  const year = new Date().getFullYear();
  const platformWhatsapp = normalizeIraqiPhone(
    import.meta.env.VITE_PLATFORM_WHATSAPP_NUMBER || import.meta.env.VITE_WHATSAPP_NUMBER || ""
  );
  const hasWhatsapp = isValidE164WithoutPlus(platformWhatsapp);
  const demoMessage = encodeURIComponent("مرحبا، اريد احجز ديمو CareChair لمركزي.");

  return (
    <footer className="site-footer">
      <div className="site-footer-inner footer-desktop-grid">
        <section className="footer-col">
          <BrandLogo className="footer-brand" />
          <p className="footer-brand-line">منصة حجوزات احترافية للصالونات ومراكز التجميل في العراق.</p>
          {hasWhatsapp ? (
            <a
              className="footer-wa-cta"
              href={`https://wa.me/${platformWhatsapp}?text=${demoMessage}`}
              target="_blank"
              rel="noreferrer"
            >
              اطلب ديمو
            </a>
          ) : null}
        </section>

        <section className="footer-col">
          <h5>روابط</h5>
          <Link to="/explore">استكشف</Link>
          <Link to="/#owners">للمراكز</Link>
          <Link to="/#pricing">الأسعار</Link>
          <Link to="/#faq">الأسئلة</Link>
        </section>

        <section className="footer-col">
          <h5>قانوني</h5>
          <Link to="/terms">الشروط</Link>
          <Link to="/privacy">الخصوصية</Link>
          <Link to="/billing">الفوترة والاسترجاع</Link>
          <Link to="/cancellation">الإلغاء والإيقاف</Link>
        </section>

        <section className="footer-col">
          <h5>تواصل</h5>
          <a href="mailto:aka.obaidy@gmail.com">aka.obaidy@gmail.com</a>
          {hasWhatsapp ? (
            <a href={`https://wa.me/${platformWhatsapp}`} target="_blank" rel="noreferrer">
              واتساب: {platformWhatsapp}
            </a>
          ) : (
            <span>واتساب غير متوفر حالياً</span>
          )}
        </section>
      </div>

      <div className="site-footer-inner footer-mobile-stack">
        <section className="footer-mobile-brand">
          <BrandLogo className="footer-brand" />
          <p className="footer-brand-line">منصة حجوزات احترافية للصالونات ومراكز التجميل في العراق.</p>
          {hasWhatsapp ? (
            <a
              className="footer-wa-cta footer-mobile-cta"
              href={`https://wa.me/${platformWhatsapp}?text=${demoMessage}`}
              target="_blank"
              rel="noreferrer"
            >
              اطلب ديمو
            </a>
          ) : null}
        </section>

        <section className="footer-mobile-group">
          <h5>روابط</h5>
          <div className="footer-mobile-links">
            <Link to="/explore">استكشف</Link>
            <Link to="/#owners">للمراكز</Link>
            <Link to="/#pricing">الأسعار</Link>
            <Link to="/#faq">الأسئلة</Link>
          </div>
        </section>

        <section className="footer-mobile-group">
          <h5>قانوني</h5>
          <div className="footer-mobile-links">
            <Link to="/terms">الشروط</Link>
            <Link to="/privacy">الخصوصية</Link>
            <Link to="/billing">الفوترة</Link>
            <Link to="/cancellation">الإلغاء</Link>
          </div>
        </section>

        <section className="footer-mobile-group">
          <h5>تواصل</h5>
          <div className="footer-mobile-links footer-mobile-contact">
            {hasWhatsapp ? (
              <a href={`https://wa.me/${platformWhatsapp}`} target="_blank" rel="noreferrer">
                واتساب: {platformWhatsapp}
              </a>
            ) : (
              <span>واتساب غير متوفر حالياً</span>
            )}
            <a href="mailto:aka.obaidy@gmail.com">aka.obaidy@gmail.com</a>
          </div>
        </section>
      </div>

      <div className="site-footer-bottom">
        <p>CareChair هو نظام حجوزات تديره شركة Infraengineering s.r.o.</p>
        <small>© {year} Infraengineering s.r.o. | IČO: 24192953 | Praha</small>
      </div>
    </footer>
  );
}
