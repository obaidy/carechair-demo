import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import BrandLogo from "../components/BrandLogo";
import Footer from "../components/Footer";
import MobileDrawer from "../components/MobileDrawer";
import SafeImage from "../components/SafeImage";
import { Button, Card } from "../components/ui";
import { getDefaultGallery, getDefaultSalonImages } from "../lib/media";
import { supabase } from "../lib/supabase";
import "../styles/landing.css";

const PLATFORM_WHATSAPP_LINK =
  "https://wa.me/9647700603080?text=%D9%85%D8%B1%D8%AD%D8%A8%D8%A7%20%D8%A7%D8%B1%D9%8A%D8%AF%20%D8%A7%D8%B9%D8%B1%D9%81%20%D8%B9%D9%86%20CareChair";

const PRODUCT_SHOTS = [
  {
    key: "admin",
    src: "/images/product/mock-admin-dashboard.webp",
    title: "لوحة الإدارة",
    caption: "إدارة الحجوزات اليومية والقبول والرفض بحركة سريعة وواضحة.",
  },
  {
    key: "booking",
    src: "/images/product/mock-booking-mobile.webp",
    title: "صفحة الحجز",
    caption: "تجربة حجز أنيقة وسريعة للعميلة من أي جهاز خلال ثواني.",
  },
  {
    key: "explore",
    src: "/images/product/mock-explore-marketplace.webp",
    title: "الاستكشاف",
    caption: "عرض المراكز والخدمات بشكل محترف يدعم التحويل للحجز.",
  },
];

const HERO_TAGS = ["يفتح على أكثر من جهاز", "ترتيب المواعيد", "إلغاء بأي وقت"];

const BEFORE_ITEMS = ["مكالمات كثيرة", "ضياع مواعيد", "ضغط على الموظفين"];
const AFTER_ITEMS = ["رابط حجز واحد", "جدول واضح", "قبول ورفض فوري"];

const FEATURES = [
  {
    key: "link",
    title: "رابط حجز واحد",
    text: "تنشرينه بالإنستغرام والواتساب وتبدين تستقبلين حجوزات مباشرة.",
  },
  {
    key: "workflow",
    title: "تنظيم الموظفين والخدمات",
    text: "ربط واضح بين كل خدمة والموظف المناسب بدون تعارض.",
  },
  {
    key: "action",
    title: "إدارة فورية للحجوزات",
    text: "قبول أو رفض الطلبات من لوحة واحدة مع حالة واضحة.",
  },
  {
    key: "hours",
    title: "ضبط ساعات العمل",
    text: "دوام أسبوعي مرن لكل مركز حسب احتياج التشغيل.",
  },
  {
    key: "media",
    title: "واجهة مركز احترافية",
    text: "صور وخدمات مرتبة تعزز ثقة العميلة قبل الحجز.",
  },
  {
    key: "scale",
    title: "جاهز للتوسع",
    text: "من فرع واحد إلى عدة فروع بنفس جودة الإدارة.",
  },
];

const TESTIMONIALS = [
  {
    quote: "الحجوزات صارت مرتبة بوضوح وقلّت المكالمات بشكل ملحوظ.",
    name: "صاحبة مركز",
    location: "بغداد",
  },
  {
    quote: "أقوى نقطة كانت سرعة تشغيل النظام وتنظيم فريق العمل من أول يوم.",
    name: "مديرة صالون",
    location: "البصرة",
  },
  {
    quote: "واجهة الحجز نظيفة وتعطي انطباع قوي للعميلة قبل ما تتواصل.",
    name: "صاحبة مركز",
    location: "بغداد",
  },
];

const FAQS = [
  {
    q: "برنامج لو تطبيق؟",
    a: "هو نظام ويب يشتغل من رابط مباشر على أي جهاز بدون تثبيت تطبيق.",
  },
  {
    q: "ينفتح بأكثر من جهاز؟",
    a: "نعم، الإدارة تقدر تستخدمه من الجوال والآيباد واللابتوب بنفس الوقت.",
  },
  {
    q: "شلون أضيف الرابط بالإنستغرام؟",
    a: "نعطيك رابط الحجز الجاهز وتحطيه مباشرة ببايو الإنستغرام أو الواتساب.",
  },
  {
    q: "شلون يتم تأكيد الحجز؟",
    a: "الحجز يوصل بلوحة الإدارة فوراً وتقدرين تقبلين أو ترفضين خلال ثواني.",
  },
];

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

function getLandingOffset() {
  if (typeof window === "undefined") return 0;
  const nav = document.querySelector(".landing-nav");
  return Math.round((nav?.getBoundingClientRect().height || 0) + 12);
}

export default function HomePage() {
  const location = useLocation();
  const [centersCount, setCentersCount] = useState(0);
  const [bookingsThisMonth, setBookingsThisMonth] = useState(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeNavItem, setActiveNavItem] = useState("owners");

  const ownersRef = useRef(null);
  const featuresRef = useRef(null);
  const pricingRef = useRef(null);
  const faqRef = useRef(null);

  const heroFallback = getDefaultSalonImages("carechair-home").cover;
  const showcaseFallbacks = getDefaultGallery("carechair-showcase").slice(0, 3);

  const sectionRefs = useMemo(
    () => ({
      owners: ownersRef,
      features: featuresRef,
      pricing: pricingRef,
      faq: faqRef,
    }),
    []
  );
  const sectionIds = useMemo(
    () => ({
      owners: "owners",
      features: "features",
      pricing: "pricing",
      faq: "faq",
    }),
    []
  );

  const scrollToSection = useCallback(
    (key) => {
      const id = sectionIds[key];
      const node = document.getElementById(id || "") || sectionRefs[key]?.current;
      if (!node) return;
      setActiveNavItem(key);
      node.scrollIntoView({ behavior: "smooth", block: "start" });
      requestAnimationFrame(() => {
        window.scrollBy({ top: -getLandingOffset(), left: 0, behavior: "auto" });
      });
      setMobileMenuOpen(false);
    },
    [sectionIds, sectionRefs]
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
    if (key) {
      requestAnimationFrame(() => scrollToSection(key));
    }
  }, [location.pathname, location.hash, sectionIds, scrollToSection]);

  const trustItems = useMemo(() => {
    return [
      `+${Math.max(50, centersCount)} مركز نشط`,
      `+${Math.max(1200, bookingsThisMonth)} حجز شهري`,
      "تفعيل خلال 24 ساعة",
      "متوفر في بغداد والبصرة",
    ];
  }, [centersCount, bookingsThisMonth]);

  return (
    <div className="landing-page" dir="rtl">
      <header className="landing-nav">
        <div className="landing-nav-inner cc-container">
          <BrandLogo className="landing-logo-main" />

          <nav className="landing-links" aria-label="روابط الصفحة">
            <Link to="/explore" className={`landing-nav-link${location.pathname === "/explore" ? " active" : ""}`}>
              استكشف
            </Link>
            <button type="button" className={`landing-nav-link${activeNavItem === "owners" ? " active" : ""}`} onClick={() => scrollToSection("owners")}>
              للمراكز
            </button>
            <button type="button" className={`landing-nav-link${activeNavItem === "features" ? " active" : ""}`} onClick={() => scrollToSection("features")}>
              المزايا
            </button>
            <button type="button" className={`landing-nav-link${activeNavItem === "pricing" ? " active" : ""}`} onClick={() => scrollToSection("pricing")}>
              الأسعار
            </button>
            <button type="button" className={`landing-nav-link${activeNavItem === "faq" ? " active" : ""}`} onClick={() => scrollToSection("faq")}>
              الأسئلة
            </button>
          </nav>

          <Button as="a" href={PLATFORM_WHATSAPP_LINK} target="_blank" rel="noreferrer" className="landing-nav-cta">
            ديمو واتساب
          </Button>

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

      <MobileDrawer open={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} id="landing-mobile-menu" title="القائمة">
        <div className="landing-mobile-menu">
          <button type="button" className={`landing-mobile-link${activeNavItem === "owners" ? " active" : ""}`} onClick={() => scrollToSection("owners")}>للمراكز</button>
          <button type="button" className={`landing-mobile-link${activeNavItem === "features" ? " active" : ""}`} onClick={() => scrollToSection("features")}>المزايا</button>
          <button type="button" className={`landing-mobile-link${activeNavItem === "pricing" ? " active" : ""}`} onClick={() => scrollToSection("pricing")}>الأسعار</button>
          <button type="button" className={`landing-mobile-link${activeNavItem === "faq" ? " active" : ""}`} onClick={() => scrollToSection("faq")}>الأسئلة</button>
          <Link className={`landing-mobile-link${location.pathname === "/explore" ? " active" : ""}`} to="/explore" onClick={() => setMobileMenuOpen(false)}>
            استكشف المراكز
          </Link>
          <Button
            as="a"
            href={PLATFORM_WHATSAPP_LINK}
            target="_blank"
            rel="noreferrer"
            className="landing-mobile-link"
            onClick={() => setMobileMenuOpen(false)}
          >
            اطلب نسخة لمركزك
          </Button>
        </div>
      </MobileDrawer>

      <main className="landing-main">
        <section className="landing-hero reveal-on-scroll is-visible">
          <div className="landing-hero-grid cc-container">
            <div className="landing-hero-visual">
              <SafeImage
                src="/images/hero/hero-salon-baghdad-01.webp"
                alt="صالون في بغداد"
                className="landing-hero-image"
                fallbackIcon="✨"
                style={{ backgroundImage: `url('${heroFallback}')`, backgroundPosition: "center left" }}
              />
              <div className="landing-hero-overlay" />
            </div>

            <div className="landing-hero-content-wrap">
              <div className="landing-hero-content">
                <h1>
                  <span className="hero-line">حول حجوزات مركزك</span>
                  <span className="hero-line hero-line-accent">إلى نظام احترافي</span>
                  <span className="hero-line">بدون فوضى واتساب</span>
                </h1>
                <p>رابط حجز ذكي + لوحة إدارة متقدمة + تنظيم كامل للموظفين والخدمات خلال 24 ساعة.</p>

                <div className="landing-hero-cta">
                  <Button as="a" href={PLATFORM_WHATSAPP_LINK} target="_blank" rel="noreferrer">
                    اطلب نسخة لمركزك
                  </Button>
                  <Button as={Link} to="/explore" variant="secondary">
                    استعرض المراكز
                  </Button>
                </div>

                <div className="landing-proof-inline">
                  {HERO_TAGS.map((tag) => (
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

        <section id="owners" ref={ownersRef} className="landing-section cc-container reveal-on-scroll">
          <div className="landing-section-head">
            <h2>قبل وبعد CareChair</h2>
          </div>

          <div className="landing-transform-grid">
            <Card className="transform-card before">
              <h3>قبل CareChair</h3>
              <ul>
                {BEFORE_ITEMS.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </Card>

            <Card className="transform-card after">
              <h3>بعد CareChair</h3>
              <ul>
                {AFTER_ITEMS.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </Card>
          </div>
        </section>

        <section className="landing-section cc-container reveal-on-scroll">
          <div className="landing-section-head">
            <h2>شوف النظام</h2>
          </div>

          <div className="landing-product-grid">
            {PRODUCT_SHOTS.map((shot, idx) => (
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

        <section id="features" ref={featuresRef} className="landing-section landing-features-section reveal-on-scroll">
          <div className="cc-container">
            <div className="landing-section-head">
              <h2>مميزات النظام</h2>
            </div>

            <div className="landing-features-grid">
              {FEATURES.map((feature) => (
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

        <section id="pricing" ref={pricingRef} className="landing-section cc-container reveal-on-scroll">
          <div className="landing-section-head">
            <h2>الأسعار</h2>
          </div>

          <div className="landing-pricing-grid">
            <Card className="landing-price-card monthly">
              <span className="price-label">الخطة الشهرية</span>
              <h3>ابتداءً من 30$</h3>
              <p>لكل شهر</p>
              <ul>
                <li>يشمل إعداد التشغيل والخدمات والموظفين</li>
                <li>إدارة يومية واضحة للحجوزات</li>
                <li>إلغاء بأي وقت</li>
              </ul>
              <Button as="a" href={PLATFORM_WHATSAPP_LINK} target="_blank" rel="noreferrer" className="pricing-cta-btn">
                ابدأ الآن
              </Button>
            </Card>

            <Card className="landing-price-card">
              <span className="price-label">إطلاق النظام</span>
              <h3>ابتداءً من 300$</h3>
              <p>مرة واحدة</p>
              <ul>
                <li>تجهيز النظام لأول مرة</li>
                <li>تهيئة الخدمات والموظفين وساعات العمل</li>
                <li>غير مسترجعة بعد بدء التجهيز</li>
              </ul>
              <Button as="a" href={PLATFORM_WHATSAPP_LINK} target="_blank" rel="noreferrer" variant="secondary" className="pricing-cta-btn">
                اطلب التجهيز
              </Button>
            </Card>
          </div>
        </section>

        <section className="landing-section landing-testimonials-section cc-container reveal-on-scroll">
          <div className="landing-section-head">
            <h2>آراء المراكز</h2>
          </div>
          <div className="landing-testimonials">
            {TESTIMONIALS.map((item) => (
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

        <section id="faq" ref={faqRef} className="landing-section cc-container reveal-on-scroll">
          <div className="landing-section-head">
            <h2>الأسئلة الشائعة</h2>
          </div>
          <div className="landing-faq-grid">
            {FAQS.map((item) => (
              <Card key={item.q} className="landing-faq-item">
                <h3>{item.q}</h3>
                <p>{item.a}</p>
              </Card>
            ))}
          </div>
        </section>

        <section className="landing-final-cta reveal-on-scroll">
          <div className="landing-final-inner cc-container">
            <h2>جاهز نخلي مركزك يستقبل حجوزات مرتبة؟</h2>
            <p>نجهز النظام بسرعة حتى تبدأ التشغيل بثقة من أول يوم.</p>
            <div className="landing-final-actions">
              <Button as="a" href={PLATFORM_WHATSAPP_LINK} target="_blank" rel="noreferrer">
                احجز ديمو 5 دقائق
              </Button>
              <Button as={Link} to="/explore" variant="secondary">
                استعرض المراكز
              </Button>
            </div>
          </div>
        </section>
      </main>

      <div className="mobile-sticky-cta">
        <Button as="a" href={PLATFORM_WHATSAPP_LINK} target="_blank" rel="noreferrer">
          ديمو واتساب
        </Button>
        <Button as={Link} to="/explore" variant="secondary">
          استعرض المراكز
        </Button>
      </div>

      <Footer />
    </div>
  );
}
