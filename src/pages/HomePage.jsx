import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import BrandLogo from "../components/BrandLogo";
import Footer from "../components/Footer";
import LanguageSwitcher from "../components/LanguageSwitcher";
import MobileDrawer from "../components/MobileDrawer";
import SafeImage from "../components/SafeImage";
import { Button, Card } from "../components/ui";
import { getDefaultGallery, getDefaultSalonImages } from "../lib/media";
import { supabase } from "../lib/supabase";
import "../styles/landing.css";

const PLATFORM_WHATSAPP_LINK =
  "https://wa.me/9647700603080?text=%D9%85%D8%B1%D8%AD%D8%A8%D8%A7%20%D8%A7%D8%B1%D9%8A%D8%AF%20%D8%A7%D8%B9%D8%B1%D9%81%20%D8%B9%D9%86%20CareChair";

function FeatureIcon({ type }) {
  const paths = {
    link: "M8 12h8M12 8v8M5.5 5.5l13 13",
    workflow: "M6 6h12M6 12h12M6 18h8",
    action: "M7 12l3 3 7-7",
    hours: "M12 7v5l3 2",
    media: "M6 18l4-5 3 3 3-4 2 6",
    scale: "M6 16l4-4 3 3 5-6",
  };

  return (
    <span className="feature-icon" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d={paths[type] || paths.link} />
      </svg>
    </span>
  );
}

export default function HomePage() {
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const [centersCount, setCentersCount] = useState(0);
  const [bookingsThisMonth, setBookingsThisMonth] = useState(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeNavItem, setActiveNavItem] = useState("owners");

  const heroFallback = getDefaultSalonImages("carechair-home").cover;
  const showcaseFallbacks = getDefaultGallery("carechair-showcase").slice(0, 3);

  const sectionIds = useMemo(
    () => ({
      owners: "owners",
      features: "features",
      pricing: "pricing",
      faq: "faq",
    }),
    []
  );

  const handleSectionNavClick = useCallback(
    (_event, key) => {
      if (!sectionIds[key]) return;
      setActiveNavItem(key);
      setMobileMenuOpen(false);
    },
    [sectionIds]
  );

  useEffect(() => {
    async function loadStats() {
      if (!supabase) return;

      try {
        const [salonsRes, bookingsRes] = await Promise.all([
          supabase.from("salons").select("id", { count: "exact", head: true }).eq("is_active", true),
          supabase
            .from("bookings")
            .select("id", { count: "exact", head: true })
            .gte("created_at", new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()),
        ]);

        if (!salonsRes.error) setCentersCount(salonsRes.count || 0);
        if (!bookingsRes.error) setBookingsThisMonth(bookingsRes.count || 0);
      } catch {
        // Ignore optional counters error in demo mode.
      }
    }

    loadStats();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const nodes = Array.from(document.querySelectorAll(".reveal-on-scroll"));
    if (nodes.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        }
      },
      {
        threshold: 0.14,
        rootMargin: "0px 0px -30px 0px",
      }
    );

    for (const node of nodes) observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const closeOnDesktop = () => {
      if (window.innerWidth > 768) setMobileMenuOpen(false);
    };
    window.addEventListener("resize", closeOnDesktop);
    return () => window.removeEventListener("resize", closeOnDesktop);
  }, []);

  useEffect(() => {
    if (location.pathname !== "/" || !location.hash) return;
    const id = decodeURIComponent(location.hash.replace(/^#/, "")).trim();
    if (!id) return;
    const key = Object.keys(sectionIds).find((x) => sectionIds[x] === id);
    if (key) setActiveNavItem(key);
  }, [location.pathname, location.hash, sectionIds]);

  const heroTags = useMemo(() => [t("home.tag1"), t("home.tag2"), t("home.tag3")], [t]);
  const productShots = useMemo(
    () => [
      {
        key: "admin",
        src: "/images/product/mock-admin-dashboard.webp",
        title: t("home.showcase.adminTitle"),
        caption: t("home.showcase.adminCaption"),
      },
      {
        key: "booking",
        src: "/images/product/mock-booking-mobile.webp",
        title: t("home.showcase.bookingTitle"),
        caption: t("home.showcase.bookingCaption"),
      },
      {
        key: "explore",
        src: "/images/product/mock-explore-marketplace.webp",
        title: t("home.showcase.exploreTitle"),
        caption: t("home.showcase.exploreCaption"),
      },
    ],
    [t]
  );
  const beforeItems = useMemo(() => [t("home.before.1"), t("home.before.2"), t("home.before.3")], [t]);
  const afterItems = useMemo(() => [t("home.after.1"), t("home.after.2"), t("home.after.3")], [t]);
  const features = useMemo(
    () => [
      { key: "link", title: t("home.features.link.title"), text: t("home.features.link.text") },
      { key: "workflow", title: t("home.features.workflow.title"), text: t("home.features.workflow.text") },
      { key: "action", title: t("home.features.action.title"), text: t("home.features.action.text") },
      { key: "hours", title: t("home.features.hours.title"), text: t("home.features.hours.text") },
      { key: "media", title: t("home.features.media.title"), text: t("home.features.media.text") },
      { key: "scale", title: t("home.features.scale.title"), text: t("home.features.scale.text") },
    ],
    [t]
  );
  const testimonials = useMemo(
    () => [
      { quote: t("home.testimonials.1.quote"), name: t("home.testimonials.1.name"), location: t("home.testimonials.1.location") },
      { quote: t("home.testimonials.2.quote"), name: t("home.testimonials.2.name"), location: t("home.testimonials.2.location") },
      { quote: t("home.testimonials.3.quote"), name: t("home.testimonials.3.name"), location: t("home.testimonials.3.location") },
    ],
    [t]
  );
  const faqs = useMemo(
    () => [
      { q: t("home.faq.1.q"), a: t("home.faq.1.a") },
      { q: t("home.faq.2.q"), a: t("home.faq.2.a") },
      { q: t("home.faq.3.q"), a: t("home.faq.3.a") },
      { q: t("home.faq.4.q"), a: t("home.faq.4.a") },
    ],
    [t]
  );

  const trustItems = useMemo(() => {
    return [
      t("home.trust.activeCenters", { count: Math.max(50, centersCount) }),
      t("home.trust.monthlyBookings", { count: Math.max(1200, bookingsThisMonth) }),
      t("home.trust.activation"),
      t("home.trust.cities"),
    ];
  }, [centersCount, bookingsThisMonth, t]);

  return (
    <div className={`landing-page ${i18n.dir() === "rtl" ? "is-rtl" : "is-ltr"}`} dir={i18n.dir()}>
      <header className="landing-nav">
        <div className="landing-nav-inner cc-container">
          <BrandLogo className="landing-logo-main" />

          <nav className="landing-links" aria-label={t("nav.menu")}>
            <Link to="/explore" className={`landing-nav-link${location.pathname === "/explore" ? " active" : ""}`}>
              {t("common.explore")}
            </Link>
            <Link
              to="/#owners"
              className={`landing-nav-link${activeNavItem === "owners" ? " active" : ""}`}
              onClick={(event) => handleSectionNavClick(event, "owners")}
            >
              {t("nav.centers")}
            </Link>
            <Link
              to="/#features"
              className={`landing-nav-link${activeNavItem === "features" ? " active" : ""}`}
              onClick={(event) => handleSectionNavClick(event, "features")}
            >
              {t("nav.features")}
            </Link>
            <Link
              to="/pricing"
              className={`landing-nav-link${activeNavItem === "pricing" ? " active" : ""}`}
              onClick={(event) => handleSectionNavClick(event, "pricing")}
            >
              {t("nav.pricing")}
            </Link>
            <Link
              to="/#faq"
              className={`landing-nav-link${activeNavItem === "faq" ? " active" : ""}`}
              onClick={(event) => handleSectionNavClick(event, "faq")}
            >
              {t("nav.faq")}
            </Link>
          </nav>

          <Button as="a" href={PLATFORM_WHATSAPP_LINK} target="_blank" rel="noreferrer" className="landing-nav-cta">
            {t("common.whatsappDemo")}
          </Button>
          <LanguageSwitcher className="landing-lang-switcher" />

          <button
            type="button"
            className="landing-menu-toggle"
            onClick={() => setMobileMenuOpen((v) => !v)}
            aria-expanded={mobileMenuOpen}
            aria-controls="landing-mobile-menu"
          >
            {mobileMenuOpen ? "✕" : "☰"}
          </button>
        </div>
      </header>

      <MobileDrawer open={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} id="landing-mobile-menu" title={t("nav.menu")}>
        <div className="landing-mobile-menu">
          <Link
            to="/#owners"
            className={`landing-mobile-link${activeNavItem === "owners" ? " active" : ""}`}
            onClick={(event) => handleSectionNavClick(event, "owners")}
          >
            {t("nav.centers")}
          </Link>
          <Link
            to="/#features"
            className={`landing-mobile-link${activeNavItem === "features" ? " active" : ""}`}
            onClick={(event) => handleSectionNavClick(event, "features")}
          >
            {t("nav.features")}
          </Link>
          <Link
            to="/pricing"
            className={`landing-mobile-link${activeNavItem === "pricing" ? " active" : ""}`}
            onClick={(event) => handleSectionNavClick(event, "pricing")}
          >
            {t("nav.pricing")}
          </Link>
          <Link
            to="/#faq"
            className={`landing-mobile-link${activeNavItem === "faq" ? " active" : ""}`}
            onClick={(event) => handleSectionNavClick(event, "faq")}
          >
            {t("nav.faq")}
          </Link>
          <Link className={`landing-mobile-link${location.pathname === "/explore" ? " active" : ""}`} to="/explore" onClick={() => setMobileMenuOpen(false)}>
            {t("home.ctaExplore")}
          </Link>
          <Button
            as="a"
            href={PLATFORM_WHATSAPP_LINK}
            target="_blank"
            rel="noreferrer"
            className="landing-mobile-link"
            onClick={() => setMobileMenuOpen(false)}
          >
            {t("home.ctaMain")}
          </Button>
          <LanguageSwitcher className="landing-mobile-link" />
        </div>
      </MobileDrawer>

      <main className="landing-main">
        <section className="landing-hero reveal-on-scroll is-visible">
          <div className="landing-hero-grid cc-container">
            <div className="landing-hero-visual">
              <SafeImage
                src="/images/hero/hero-salon-baghdad-01.webp"
                alt={t("home.heroImageAlt")}
                className="landing-hero-image"
                fallbackIcon="✨"
                style={{ backgroundImage: `url('${heroFallback}')`, backgroundPosition: "center left" }}
              />
              <div className="landing-hero-overlay" />
            </div>

            <div className="landing-hero-content-wrap">
              <div className="landing-hero-content">
                <h1>
                  <span className="hero-line">{t("home.headline1")}</span>{" "}
                  <span className="hero-line hero-line-accent">{t("home.headline2")}</span>{" "}
                  <span className="hero-line">{t("home.headline3")}</span>
                </h1>
                <p>{t("home.subheadline")}</p>

                <div className="landing-hero-cta">
                  <Button as="a" href={PLATFORM_WHATSAPP_LINK} target="_blank" rel="noreferrer">
                    {t("home.ctaMain")}
                  </Button>
                  <Button as={Link} to="/explore" variant="secondary">
                    {t("home.ctaExplore")}
                  </Button>
                </div>

                <div className="landing-proof-inline">
                  {heroTags.map((tag) => (
                    <span key={tag}>{tag}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="landing-trust-strip reveal-on-scroll">
          <div className="landing-trust-inner cc-container">
            {trustItems.map((item) => (
              <span key={item} className="landing-trust-item">
                {item}
              </span>
            ))}
          </div>
        </section>

        <section id="owners" className="landing-section cc-container reveal-on-scroll">
          <div className="landing-section-head">
            <h2>{t("home.sectionBeforeAfter")}</h2>
          </div>

          <div className="landing-transform-grid">
            <Card className="transform-card before">
              <h3>{t("home.beforeTitle")}</h3>
              <ul>
                {beforeItems.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </Card>

            <Card className="transform-card after">
              <h3>{t("home.afterTitle")}</h3>
              <ul>
                {afterItems.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </Card>
          </div>
        </section>

        <section className="landing-section cc-container reveal-on-scroll">
          <div className="landing-section-head">
            <h2>{t("home.sectionShow")}</h2>
          </div>

          <div className="landing-product-grid">
            {productShots.map((shot, idx) => (
              <article key={shot.key} className="landing-shot-card reveal-on-scroll">
                <SafeImage
                  src={shot.src}
                  alt={shot.title}
                  className="landing-shot-image"
                  fallbackIcon="🖥️"
                  style={{ backgroundImage: `url('${showcaseFallbacks[idx] || showcaseFallbacks[0]}')` }}
                />
                <div className="landing-shot-meta">
                  <b>{shot.title}</b>
                  <p>{shot.caption}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section id="features" className="landing-section landing-features-section reveal-on-scroll">
          <div className="cc-container">
            <div className="landing-section-head">
              <h2>{t("home.sectionFeatures")}</h2>
            </div>

            <div className="landing-features-grid">
              {features.map((feature) => (
                <Card className="landing-feature" key={feature.title}>
                  <FeatureIcon type={feature.key} />
                  <div>
                    <b>{feature.title}</b>
                    <p>{feature.text}</p>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section id="pricing" className="landing-section cc-container reveal-on-scroll">
          <div className="landing-section-head">
            <h2>{t("home.sectionPricing")}</h2>
          </div>

          <div className="landing-pricing-grid">
            <Card className="landing-price-card monthly">
              <span className="price-label">{t("pricing.basic")}</span>
              <h3>{t("pricing.talkToSales")}</h3>
              <p>{t("pricing.noPublicPrices")}</p>
              <ul>
                <li>{t("home.pricingBullets.1")}</li>
                <li>{t("home.pricingBullets.2")}</li>
                <li>{t("home.pricingBullets.3")}</li>
              </ul>
              <Button as={Link} to="/pricing" className="pricing-cta-btn">
                {t("pricing.talkToSales")}
              </Button>
            </Card>

            <Card className="landing-price-card">
              <span className="price-label">{t("pricing.enterprise")}</span>
              <h3>{t("common.bookDemo")}</h3>
              <p>{t("pricing.subtitle")}</p>
              <ul>
                <li>{t("home.enterpriseBullets.1")}</li>
                <li>{t("home.enterpriseBullets.2")}</li>
                <li>{t("home.enterpriseBullets.3")}</li>
              </ul>
              <Button as="a" href={PLATFORM_WHATSAPP_LINK} target="_blank" rel="noreferrer" variant="secondary" className="pricing-cta-btn">
                {t("common.bookDemo")}
              </Button>
            </Card>
          </div>
        </section>

        <section className="landing-section landing-testimonials-section cc-container reveal-on-scroll">
          <div className="landing-section-head">
            <h2>{t("home.sectionTestimonials")}</h2>
          </div>
          <div className="landing-testimonials">
            {testimonials.map((item) => (
              <article className="landing-testimonial" key={item.quote}>
                <div className="testimonial-stars">★★★★★</div>
                <p className="testimonial-quote">{item.quote}</p>
                <div className="testimonial-meta">
                  <b>{item.name}</b>
                  <span>{item.location}</span>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section id="faq" className="landing-section cc-container reveal-on-scroll">
          <div className="landing-section-head">
            <h2>{t("home.sectionFaq")}</h2>
          </div>
          <div className="landing-faq-grid">
            {faqs.map((item) => (
              <Card key={item.q} className="landing-faq-item">
                <h3>{item.q}</h3>
                <p>{item.a}</p>
              </Card>
            ))}
          </div>
        </section>

        <section className="landing-final-cta reveal-on-scroll">
          <div className="landing-final-inner cc-container">
            <h2>{t("home.finalTitle")}</h2>
            <p>{t("home.finalSubtitle")}</p>
            <div className="landing-final-actions">
              <Button as="a" href={PLATFORM_WHATSAPP_LINK} target="_blank" rel="noreferrer">
                {t("common.bookDemo")}
              </Button>
              <Button as={Link} to="/explore" variant="secondary">
                {t("home.ctaExplore")}
              </Button>
            </div>
          </div>
        </section>
      </main>

      <div className="mobile-sticky-cta">
        <Button as="a" href={PLATFORM_WHATSAPP_LINK} target="_blank" rel="noreferrer">
          {t("common.whatsappDemo")}
        </Button>
        <Button as={Link} to="/explore" variant="secondary">
          {t("home.ctaExplore")}
        </Button>
      </div>

      <Footer />
    </div>
  );
}
