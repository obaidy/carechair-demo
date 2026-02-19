import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import BrandLogo from "../components/BrandLogo";
import Footer from "../components/Footer";
import SafeImage from "../components/SafeImage";
import { Badge, Button, Card, Skeleton } from "../components/ui";
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
    caption: "متابعة الطلبات، القبول والرفض، وحالة التشغيل اليومية من شاشة واحدة.",
  },
  {
    key: "booking",
    src: "/images/product/mock-booking-mobile.webp",
    title: "صفحة الحجز",
    caption: "تجربة عميلة سريعة وواضحة مع اختيار الخدمة والموعد خلال ثواني.",
  },
  {
    key: "explore",
    src: "/images/product/mock-explore-marketplace.webp",
    title: "الاستكشاف",
    caption: "واجهة احترافية لعرض المراكز والخدمات وتحويل الزيارات إلى حجوزات.",
  },
];

const PROMISE_BULLETS = [
  "نضيف الخدمات والأسعار",
  "نرتب الموظفين",
  "نحدد ساعات العمل",
  "نسلمك رابط حجز جاهز",
];

const FEATURES = [
  { icon: "🔗", title: "رابط حجز ذكي", text: "رابط واحد جاهز للإنستغرام والواتساب." },
  { icon: "🧭", title: "تنظيم تشغيل يومي", text: "توزيع واضح للخدمات والموظفين بدون ارتباك." },
  { icon: "✅", title: "قبول ورفض فوري", text: "إدارة الحجوزات بسرعة مع تحديث مباشر للحالة." },
  { icon: "🕒", title: "ساعات عمل مرنة", text: "تحدد الدوام والأيام المغلقة لكل مركز بسهولة." },
  { icon: "🖼️", title: "عرض احترافي للمركز", text: "صور وخدمات مرتبة تعكس جودة البراند." },
  { icon: "📈", title: "قابل للتوسع", text: "بنية جاهزة للنمو مع فروع أكثر وحجوزات أعلى." },
];

const TESTIMONIALS = [
  {
    name: "نوف",
    role: "صاحبة مركز — بغداد",
    quote: "صار عدنا نظام واضح، والعميلات تحجز بسهولة بدون دوخة المكالمات.",
    stars: 5,
  },
  {
    name: "زهراء",
    role: "مديرة صالون — بغداد",
    quote: "لوحة الإدارة اختصرت وقت كبير وخففت الأخطاء بتأكيد المواعيد.",
    stars: 5,
  },
  {
    name: "شهد",
    role: "صاحبة مركز — بغداد",
    quote: "النتيجة كانت سريعة: تنظيم أعلى ومظهر احترافي قدام العميلات.",
    stars: 5,
  },
];

export default function HomePage() {
  const [statsLoading, setStatsLoading] = useState(true);
  const [centersCount, setCentersCount] = useState(0);
  const [bookingsThisMonth, setBookingsThisMonth] = useState(0);

  const heroFallback = getDefaultSalonImages("carechair-home").cover;
  const showcaseFallbacks = getDefaultGallery("carechair-showcase").slice(0, 3);

  useEffect(() => {
    async function loadStats() {
      if (!supabase) {
        setStatsLoading(false);
        return;
      }

      setStatsLoading(true);
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
      } catch (err) {
        console.error("landing stats error", err);
      } finally {
        setStatsLoading(false);
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

  const proofCards = useMemo(() => {
    const cards = [
      {
        key: "centers",
        label: "مراكز مسجلة",
        value: String(centersCount),
      },
    ];

    if (bookingsThisMonth > 0) {
      cards.push({
        key: "bookings",
        label: "حجوزات هذا الشهر",
        value: String(bookingsThisMonth),
      });
    }

    return cards;
  }, [centersCount, bookingsThisMonth]);

  return (
    <div className="landing-page" dir="rtl">
      <header className="landing-nav">
        <div className="landing-nav-inner cc-container">
          <BrandLogo className="landing-logo-main" />

          <nav className="landing-links" aria-label="روابط الصفحة">
            <Link to="/explore" className="active">
              استكشف
            </Link>
            <a href="#owners">للمراكز</a>
            <a href="#features">المزايا</a>
            <a href="#pricing">الأسعار</a>
          </nav>

          <Button as="a" href={PLATFORM_WHATSAPP_LINK} target="_blank" rel="noreferrer" className="landing-nav-cta">
            ديمو واتساب
          </Button>
        </div>
      </header>

      <main className="landing-main cc-container">
        <section className="landing-hero reveal-on-scroll is-visible">
          <SafeImage
            src="/images/hero/hero-salon-baghdad-01.webp"
            alt="صالون في بغداد"
            className="landing-hero-bg"
            fallbackIcon="✨"
            style={{ backgroundImage: `url('${heroFallback}')` }}
          />
          <div className="landing-hero-overlay" />

          <div className="landing-hero-content">
            <Badge variant="featured">CareChair للصالونات ومراكز التجميل</Badge>
            <h1>حوّل فوضى الواتساب إلى نظام حجوزات احترافي</h1>
            <p>
              رابط حجز ذكي + لوحة إدارة متقدمة + تنظيم كامل للموظفين والخدمات — جاهز خلال يوم
              واحد.
            </p>

            <div className="landing-hero-cta">
              <Button as="a" href={PLATFORM_WHATSAPP_LINK} target="_blank" rel="noreferrer">
                اطلب نظام لمركزك
              </Button>
              <Button as={Link} to="/explore" variant="secondary">
                استعرض المراكز
              </Button>
            </div>

            <div className="landing-proof-inline">
              <span>تفعيل خلال 24 ساعة</span>
              <span>يعمل على أكثر من جهاز</span>
              <span>تنظيم ذكي للمواعيد</span>
            </div>
          </div>
        </section>

        <section className="landing-proof reveal-on-scroll">
          {statsLoading ? (
            <div className="landing-proof-grid">
              {Array.from({ length: 3 }).map((_, idx) => (
                <Card className="landing-proof-card" key={`proof-sk-${idx}`}>
                  <Skeleton className="skeleton-line short" />
                  <Skeleton className="skeleton-line" />
                </Card>
              ))}
            </div>
          ) : (
            <div className="landing-proof-grid">
              {proofCards.map((item) => (
                <Card className="landing-proof-card" key={item.key}>
                  <span className="landing-proof-label">{item.label}</span>
                  <b className="landing-proof-value">{item.value}</b>
                </Card>
              ))}
            </div>
          )}
        </section>

        <section id="owners" className="landing-section reveal-on-scroll">
          <div className="landing-section-head">
            <h2>نجهز مركزك خلال يوم واحد</h2>
          </div>

          <div className="landing-promise-grid">
            <Card className="landing-promise-image-card">
              <SafeImage
                src="/images/sections/owner-tablet.webp"
                alt="صاحب مركز يستخدم التابلت"
                className="landing-promise-image"
                fallbackIcon="📱"
              />
            </Card>

            <Card className="landing-promise-card">
              <ul>
                {PROMISE_BULLETS.map((bullet) => (
                  <li key={bullet}>{bullet}</li>
                ))}
              </ul>
            </Card>
          </div>
        </section>

        <section className="landing-section reveal-on-scroll">
          <div className="landing-section-head">
            <h2>شوف النظام</h2>
          </div>

          <div className="landing-product-grid">
            {PRODUCT_SHOTS.map((shot, idx) => (
              <Card key={shot.key} className="landing-shot-card reveal-on-scroll">
                <div className="device-frame">
                  <div className="device-notch" />
                  <SafeImage
                    src={shot.src}
                    alt={shot.title}
                    className="landing-shot-image"
                    fallbackIcon="🖥️"
                    style={{ backgroundImage: `url('${showcaseFallbacks[idx] || showcaseFallbacks[0]}')` }}
                  />
                </div>
                <div className="landing-shot-meta">
                  <b>{shot.title}</b>
                  <p>{shot.caption}</p>
                </div>
              </Card>
            ))}
          </div>
        </section>

        <section id="features" className="landing-section reveal-on-scroll">
          <div className="landing-section-head">
            <h2>مميزات النظام</h2>
          </div>

          <div className="landing-features-grid">
            {FEATURES.map((feature) => (
              <Card className="landing-feature" key={feature.title}>
                <span className="feature-icon">{feature.icon}</span>
                <div>
                  <b>{feature.title}</b>
                  <p>{feature.text}</p>
                </div>
              </Card>
            ))}
          </div>
        </section>

        <section id="pricing" className="landing-section reveal-on-scroll">
          <div className="landing-section-head">
            <h2>الأسعار</h2>
          </div>

          <div className="landing-pricing-grid">
            <Card className="landing-price-card monthly">
              <span className="price-badge">الأكثر طلباً</span>
              <span className="price-label">الاشتراك الشهري</span>
              <h3>30–50</h3>
              <p>دولار / شهر</p>
              <ul>
                <li>إلغاء بأي وقت</li>
                <li>الدعم متوفر</li>
                <li>الاشتراك يبقى فعال لنهاية الفترة المدفوعة</li>
              </ul>
              <Button as="a" href={PLATFORM_WHATSAPP_LINK} target="_blank" rel="noreferrer" className="pricing-cta-btn">
                ابدأ الآن
              </Button>
            </Card>

            <Card className="landing-price-card">
              <span className="price-label">تشغيل أول مرة</span>
              <h3>300–500</h3>
              <p>دولار مرة واحدة</p>
              <ul>
                <li>إعداد كامل للنظام</li>
                <li>تهيئة الخدمات والموظفين</li>
                <li>غير مسترجعة بعد بدء التجهيز</li>
              </ul>
              <Button as="a" href={PLATFORM_WHATSAPP_LINK} target="_blank" rel="noreferrer" variant="secondary" className="pricing-cta-btn">
                اطلب التجهيز
              </Button>
            </Card>
          </div>
        </section>

        <section className="landing-section reveal-on-scroll">
          <div className="landing-section-head">
            <h2>آراء المراكز</h2>
          </div>
          <div className="landing-testimonials">
            {TESTIMONIALS.map((item) => (
              <Card className="landing-testimonial" key={item.quote}>
                <div className="testimonial-head">
                  <div className="avatar-circle">{item.name.slice(0, 1)}</div>
                  <div>
                    <b>{item.name}</b>
                    <span>{item.role}</span>
                  </div>
                </div>
                <div className="testimonial-stars">{"★".repeat(item.stars)}</div>
                <p>{item.quote}</p>
              </Card>
            ))}
          </div>
        </section>

        <section className="landing-final-cta reveal-on-scroll">
          <Card className="landing-final-card">
            <h2>جاهز تخلي مركزك يستقبل حجوزات مرتبة؟</h2>
            <p>خل نطلق رابط الحجز الخاص بمركزك ونبدأ التشغيل خلال 24 ساعة.</p>
            <div className="landing-final-actions">
              <Button as="a" href={PLATFORM_WHATSAPP_LINK} target="_blank" rel="noreferrer">
                اطلب نظام لمركزك
              </Button>
              <Button as={Link} to="/explore" variant="secondary">
                استعرض المراكز
              </Button>
            </div>
          </Card>
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
